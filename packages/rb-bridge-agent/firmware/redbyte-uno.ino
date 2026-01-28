
/**
 * RedByte UNO Firmware v1.0
 * Minimal line-based serial protocol for deterministic I/O.
 * Baud: 115200
 */

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; } // wait for serial port to connect
  
  // Set default pin modes
  pinMode(13, OUTPUT);
  digitalWrite(13, LOW);
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.startsWith("SET ")) {
      // Format: SET <PIN_ID> <VALUE>
      // e.g., SET D13 1
      int firstSpace = cmd.indexOf(' ');
      int lastSpace = cmd.lastIndexOf(' ');
      
      if (firstSpace != -1 && lastSpace != -1 && firstSpace != lastSpace) {
        String pinId = cmd.substring(firstSpace + 1, lastSpace);
        String valStr = cmd.substring(lastSpace + 1);
        int value = valStr.toInt();
        
        // Map D-prefixed pin IDs to board pins
        if (pinId.startsWith("D")) {
          int pinNum = pinId.substring(1).toInt();
          pinMode(pinNum, OUTPUT);
          digitalWrite(pinNum, value == 1 ? HIGH : LOW);
          Serial.println("OK");
        } else {
          Serial.println("ERR INVALID_PIN");
        }
      } else {
        Serial.println("ERR INVALID_FORMAT");
      }
    } 
    else if (cmd == "GET") {
      // Simple response for D13, extend as needed
      int d13 = digitalRead(13);
      Serial.print("PINS D13=");
      Serial.println(d13);
    }
    else if (cmd == "PING") {
      Serial.println("PONG");
    }
    else if (cmd != "") {
      Serial.print("ERR UNKNOWN_CMD: ");
      Serial.println(cmd);
    }
  }
}
