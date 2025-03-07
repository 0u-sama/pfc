#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>

const char* ssid = "arc";
const char* password = "arc20242025";
const char* serverIP = "192.168.43.137"; // Update with ESP32 #3's IP

#define xPin 36
#define yPin 39
#define zPin 34
#define ledPin 13
int led = 2;
int vs = 4;
#define RX_PIN 17
#define TX_PIN 16
#define SEALEVELPRESSURE_HPA (1013.25)

Adafruit_BME280 bme;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

const int samples = 10;
const int fallThreshold = 200;
const int numCalibrationSamples = 100;

int xOffset = 0, yOffset = 0, zOffset = 0;

unsigned long previousMillis = 0;
const long interval = 2000;

void calibrateSensor();
bool isTreeFalling(int x, int y, int z);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");

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
}

void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

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

    double latitude = 0.0, longitude = 0.0;
    String timestamp = "";
    int gpsIterations = 0;
    while (gpsSerial.available() > 0 && gpsIterations < 100) {
      if (gps.encode(gpsSerial.read())) {
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

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(String("http://") + serverIP + "/update");
      http.addHeader("Content-Type", "application/json");

      StaticJsonDocument<512> doc;
      doc["id"] = "ESP32_1"; // Unique ID for this client
      doc["temperature"] = temperature;
      doc["humidity"] = humidity;
      doc["accelerometer"]["x"] = xZeroed;
      doc["accelerometer"]["y"] = yZeroed;
      doc["accelerometer"]["z"] = zZeroed;
      doc["vibration_frequency"] = frequency;
      doc["gps"]["latitude"] = latitude;
      doc["gps"]["longitude"] = longitude;
      doc["timestamp"] = timestamp;

      String jsonString;
      serializeJson(doc, jsonString);

      int httpCode = http.POST(jsonString);
      if (httpCode > 0) {
        Serial.println("Data sent: " + String(httpCode));
      } else {
        Serial.println("Error: " + http.errorToString(httpCode));
      }
      http.end();
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