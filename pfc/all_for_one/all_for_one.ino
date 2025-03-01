// Existing libraries
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <WiFi.h>
#include <WebServer.h>

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
const float TEMP_FIRE_THRESHOLD = 50.0;
const float HUMIDITY_FIRE_THRESHOLD = 20.0;
const float TEMP_RISK_THRESHOLD = 35.0;
const float HUMIDITY_RISK_THRESHOLD = 30.0;

// Calibration variables
int xOffset = 0;
int yOffset = 0;
int zOffset = 0;

// JSON file path
const char* filename = "/sensor_data.json";

// Timing variables for non-blocking delay
unsigned long previousMillis = 0;
const long interval = 200;

void calibrateSensor();
bool isTreeFalling(int x, int y, int z);
void displayGPSInfo();
void updateJsonFile(float temp, float hum, int x, int y, int z, float freq, double lat, double lng, String timestamp);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  if (!SPIFFS.begin(true)) {
    return;
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.print("http://");
  Serial.println(WiFi.localIP());

  // Set up web server route with CORS header
  server.on("/data", []() {
    File file = SPIFFS.open(filename, FILE_READ);
    if (!file) {
      server.send(404, "text/plain", "File not found");
    } else {
      server.sendHeader("Access-Control-Allow-Origin", "*"); // Allow all origins
      server.streamFile(file, "application/json");
      file.close();
    }
  });
  server.begin();

  pinMode(led, OUTPUT);
  pinMode(vs, INPUT);
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);
  digitalWrite(led, LOW);

  if (!bme.begin(0x76)) {
    while (1) delay(10);
  }

  gpsSerial.begin(9600, SERIAL_8N1, RX_PIN, TX_PIN);
  calibrateSensor();
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    server.handleClient();

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
    xRaw /= samples;
    yRaw /= samples;
    zRaw /= samples;

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

    double latitude = 0.0, longitude = 0.0;
    String timestamp = "";
    int gpsIterations = 0;
    while (gpsSerial.available() > 0 && gpsIterations < 100) {
      if (gps.encode(gpsSerial.read())) {
        displayGPSInfo();
        if (gps.location.isValid()) {
          latitude = gps.location.lat();
          longitude = gps.location.lng();
        }
        if (gps.time.isValid()) {
          char timeStr[9];
          sprintf(timeStr, "%02d:%02d:%02d", gps.time.hour(), gps.time.minute(), gps.time.second());
          timestamp = String(timeStr);
        }
      }
      gpsIterations++;
      taskYIELD();
    }

    updateJsonFile(temperature, humidity, xZeroed, yZeroed, zZeroed, frequency, latitude, longitude, timestamp);
  }
}

void updateJsonFile(float temp, float hum, int x, int y, int z, float freq, double lat, double lng, String timestamp) {
  StaticJsonDocument<512> doc;
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["accelerometer"]["x"] = x;
  doc["accelerometer"]["y"] = y;
  doc["accelerometer"]["z"] = z;
  doc["vibration_frequency"] = freq;
  doc["gps"]["latitude"] = lat;
  doc["gps"]["longitude"] = lng;
  doc["timestamp"] = timestamp;

  File file = SPIFFS.open(filename, FILE_WRITE);
  if (!file) {
    return;
  }
  serializeJson(doc, file);
  file.close();
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

void displayGPSInfo() {}