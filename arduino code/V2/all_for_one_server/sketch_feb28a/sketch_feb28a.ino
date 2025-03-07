#include <WiFi.h>
#include <WebServer.h>
#include <FS.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>

const char* ssid = "arc";
const char* password = "arc20242025";

WebServer server(80);
const char* filename = "/sensors_data.json";

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  if (!SPIFFS.begin(true)) {
    Serial.println("Failed to mount SPIFFS");
    return;
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("Server IP: http://");
  Serial.println(WiFi.localIP());

  if (!SPIFFS.exists(filename)) {
    File file = SPIFFS.open(filename, FILE_WRITE);
    file.println("{}"); // Empty object to start
    file.close();
  }

  server.on("/update", HTTP_POST, []() {
    String payload = server.arg("plain");
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, payload);

    String id = doc["id"].as<String>();
    File file = SPIFFS.open(filename, FILE_READ);
    StaticJsonDocument<2048> dataDoc;
    deserializeJson(dataDoc, file);
    file.close();

    dataDoc[id] = doc; // Add or update this client's data
    file = SPIFFS.open(filename, FILE_WRITE);
    serializeJson(dataDoc, file);
    file.close();

    server.send(200, "text/plain", "Data updated");
  });

  server.on("/data", []() {
    File file = SPIFFS.open(filename, FILE_READ);
    if (!file) {
      server.send(404, "text/plain", "File not found");
    } else {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.streamFile(file, "application/json");
      file.close();
    }
  });

  server.begin();
  Serial.println("Server started");
}

void loop() {
  server.handleClient();
}