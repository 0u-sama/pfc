#include <FS.h>
#include <SPIFFS.h>

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(100);

  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("Failed to mount SPIFFS");
    return;
  }

  // Delete sensors_data.json
  if (SPIFFS.exists("/sensors_data.json")) {
    if (SPIFFS.remove("/sensors_data.json")) {
      Serial.println("Deleted sensors_data.json successfully");
    } else {
      Serial.println("Failed to delete sensors_data.json");
    }
  } else {
    Serial.println("sensors_data.json not found - nothing to delete");
  }

  // Optional: List remaining files (debug)
  File root = SPIFFS.open("/");
  File file = root.openNextFile();
  while (file) {
    Serial.print("File: ");
    Serial.println(file.name());
    file = root.openNextFile();
  }
}

void loop() {
  // Do nothing - runs once
}