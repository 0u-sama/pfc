#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WebServer.h>
#include <FS.h>
#include <SPIFFS.h>

// Wi-Fi credentials
const char* ssid = "arc";
const char* password = "arc20242025";

// Web server on port 80
WebServer server(80);

// Pin definitions
#define xPin 36
#define yPin 39
#define zPin 34
#define ledPin 13
int led = 2;
int vs = 4;
#define RX_PIN 17
#define TX_PIN 16
#define SEALEVELPRESSURE_HPA (1013.25)

// Sensor objects
Adafruit_BME280 bme;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Constants
const int samples = 10;
const int fallThreshold = 200;
const int numCalibrationSamples = 100;

// Calibration variables
int xOffset = 0, yOffset = 0, zOffset = 0;

// Timing
unsigned long previousMillis = 0;
const long interval = 2000; // Update every 2 seconds

// JSON file path
const char* filename = "/sensors_data.json";

// Function declarations
void calibrateSensor();
bool isTreeFalling(int x, int y, int z);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("Failed to mount SPIFFS");
    return;
  }

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("Server IP: http://");
  Serial.println(WiFi.localIP());

  // Initialize JSON file if it doesn't exist
  if (!SPIFFS.exists(filename)) {
    File file = SPIFFS.open(filename, FILE_WRITE);
    file.println("{}"); // Empty object to start
    file.close();
  }

  // Set up server routes
  server.on("/data", []() {
    File file = SPIFFS.open(filename, FILE_READ);
    if (!file) {
      server.send(404, "text/plain", "File not found");
    } else {
      server.sendHeader("Access-Control-Allow-Origin", "*"); // CORS header
      server.streamFile(file, "application/json");
      file.close();
    }
  });

  server.begin();
  Serial.println("Server started");

  // Hardware setup
  pinMode(led, OUTPUT);
  pinMode(vs, INPUT);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);
  digitalWrite(led, LOW);

  if (!bme.begin(0x76)) {
    Serial.println("BME280 failed!");
    while (1) delay(10);
  }

  gpsSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  calibrateSensor();

  // Seed random number generator
  randomSeed(analogRead(0));
}

void loop() {
  server.handleClient();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Real sensor data for ESP32_1
    long measurement = pulseIn(vs, HIGH);
    float frequency = (measurement > 0) ? 1000000.0 / measurement : 0.0;
    if (frequency >= 500 && frequency <= 1500) {
      digitalWrite(led, HIGH);
    } else {
      digitalWrite(led, LOW);
    }

    int xRaw = 0, yRaw = 0, zRaw = 0;
    for (int i = 0; i < samples; i++) {
      xRaw += analogRead(xPin);
      yRaw += analogRead(yPin);
      zRaw += analogRead(zPin);
      taskYIELD();
    }
    xRaw /= samples; yRaw /= samples; zRaw /= samples;
    int xZeroed = xRaw - xOffset;
    int yZeroed = yRaw - yOffset;
    int zZeroed = zRaw - zOffset;

    if (isTreeFalling(xZeroed, yZeroed, zZeroed)) {
      digitalWrite(ledPin, HIGH);
    } else {
      digitalWrite(ledPin, LOW);
    }

    float temperature = bme.readTemperature();
    float humidity = bme.readHumidity();

    // Imaginary GPS data for ESP32_1 (since GPS doesn't work indoors)
    float latitude1 = 37.7749;  // Example: San Francisco
    float longitude1 = -122.4194;

    // Current timestamp
    unsigned long timeNow = millis() / 1000; // Simple seconds counter for simulation
    char timestamp[9];
    sprintf(timestamp, "%02d:%02d:%02d", (timeNow / 3600) % 24, (timeNow / 60) % 60, timeNow % 60);

    // Simulate ESP32_2 with offsets
    int offset = random(1, 6); // Random integer 1-5
    float gpsOffset = random(1, 6) * 0.001; // Random float 0.001-0.005
    float temperature2 = temperature + offset;
    float humidity2 = humidity + offset;
    int xZeroed2 = xZeroed + offset;
    int yZeroed2 = yZeroed + offset;
    int zZeroed2 = zZeroed + offset;
    float frequency2 = frequency + offset;
    float latitude2 = latitude1 + gpsOffset;
    float longitude2 = longitude1 + gpsOffset;

    // Create JSON document
    StaticJsonDocument<2048> doc;
    doc["ESP32_1"]["temperature"] = temperature;
    doc["ESP32_1"]["humidity"] = humidity;
    doc["ESP32_1"]["accelerometer"]["x"] = xZeroed;
    doc["ESP32_1"]["accelerometer"]["y"] = yZeroed;
    doc["ESP32_1"]["accelerometer"]["z"] = zZeroed;
    doc["ESP32_1"]["vibration_frequency"] = frequency;
    doc["ESP32_1"]["gps"]["latitude"] = latitude1;
    doc["ESP32_1"]["gps"]["longitude"] = longitude1;
    doc["ESP32_1"]["timestamp"] = String(timestamp);

    doc["ESP32_2"]["temperature"] = temperature2;
    doc["ESP32_2"]["humidity"] = humidity2;
    doc["ESP32_2"]["accelerometer"]["x"] = xZeroed2;
    doc["ESP32_2"]["accelerometer"]["y"] = yZeroed2;
    doc["ESP32_2"]["accelerometer"]["z"] = zZeroed2;
    doc["ESP32_2"]["vibration_frequency"] = frequency2;
    doc["ESP32_2"]["gps"]["latitude"] = latitude2;
    doc["ESP32_2"]["gps"]["longitude"] = longitude2;
    doc["ESP32_2"]["timestamp"] = String(timestamp);

    // Write to SPIFFS
    File file = SPIFFS.open(filename, FILE_WRITE);
    if (file) {
      serializeJson(doc, file);
      file.close();
      Serial.println("JSON updated");
    } else {
      Serial.println("Failed to open file");
    }
  }
}

bool isTreeFalling(int x, int y, int z) {
  float magnitude = sqrt(x * x + y * y + z * z);
  return (magnitude > fallThreshold);
}

void calibrateSensor() {
  long xSum = 0, ySum = 0, zSum = 0;
  for (int i = 0; i < numCalibrationSamples; i++) {
    xSum += analogRead(xPin);
    ySum += analogRead(yPin);
    zSum += analogRead(zPin);
    delay(1);
    taskYIELD();
  }
  xOffset = xSum / numCalibrationSamples;
  yOffset = ySum / numCalibrationSamples;
  zOffset = zSum / numCalibrationSamples;
}