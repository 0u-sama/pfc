#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>

const char* ssid = "arc";
const char* password = "arc20242025";
const char* nodeServer = "http://192.168.43.161:3000/update"; // Replace with your computer's IP

WebServer server(80);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("Gateway IP: http://");
  Serial.println(WiFi.localIP());

  server.on("/update", HTTP_POST, []() {
    String payload = server.arg("plain"); // Get the JSON payload from the client

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(nodeServer); // Forward to Node.js server
      http.addHeader("Content-Type", "application/json");

      int httpCode = http.POST(payload); // Send the exact payload received
      if (httpCode > 0) {
        Serial.println("Forwarded data to Node.js: " + String(httpCode));
        server.send(200, "text/plain", "Data forwarded");
      } else {
        Serial.println("Error forwarding: " + http.errorToString(httpCode));
        server.send(500, "text/plain", "Failed to forward data");
      }
      http.end();
    } else {
      server.send(503, "text/plain", "WiFi disconnected");
    }
  });

  server.begin();
  Serial.println("Gateway started");
}

void loop() {
  server.handleClient();
}