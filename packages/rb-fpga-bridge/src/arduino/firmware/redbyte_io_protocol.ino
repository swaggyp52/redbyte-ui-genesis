/**
 * RedByte Arduino I/O Protocol Firmware
 * 
 * PHASE 1 Task 1.5: Arduino Integration
 * 
 * This firmware implements the RedByte I/O protocol for Arduino Uno boards,
 * enabling real-time digital I/O control and monitoring from the RedByte platform.
 * 
 * Protocol Commands (Serial at 115200 baud):
 * - GET: Read current pin states
 * - SET <pin> <value>: Set digital pin (0=LOW, 1=HIGH)
 * - PIN <pin> <mode>: Configure pin mode (0=INPUT, 1=OUTPUT, 2=INPUT_PULLUP)
 * - PING: Heartbeat check (responds with PONG)
 * 
 * Response Format:
 * - Sends JSON-formatted state updates: {"D2":0,"D3":1,"A0":512,...}
 * - Updates sent on change or every 100ms
 * 
 * Hardware: Arduino Uno (ATmega328P)
 * Copyright © 2026 Connor Angiel — RedByte OS Genesis
 */

// Pin definitions (Arduino Uno digital pins)
const int DIGITAL_PINS[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
const int NUM_DIGITAL_PINS = 12;

// Analog pins (A0-A5)
const int ANALOG_PINS[] = {A0, A1, A2, A3, A4, A5};
const int NUM_ANALOG_PINS = 6;

// State tracking
int digitalStates[NUM_DIGITAL_PINS];
int analogStates[NUM_ANALOG_PINS];
unsigned long lastUpdateTime = 0;
const unsigned long UPDATE_INTERVAL = 100; // ms

// Serial buffer
String inputBuffer = "";

void setup() {
  Serial.begin(115200);
  
  // Initialize all digital pins as INPUT with pullup
  for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
    pinMode(DIGITAL_PINS[i], INPUT_PULLUP);
    digitalStates[i] = digitalRead(DIGITAL_PINS[i]);
  }
  
  // Read initial analog states
  for (int i = 0; i < NUM_ANALOG_PINS; i++) {
    analogStates[i] = analogRead(ANALOG_PINS[i]);
  }
  
  // Send ready message
  Serial.println("{\"status\":\"ready\",\"board\":\"Arduino Uno\",\"firmware\":\"RedByte I/O v1.0\"}");
}

void loop() {
  // Process incoming commands
  if (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }
  
  // Periodic state updates
  unsigned long currentTime = millis();
  if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
    sendStateUpdate();
    lastUpdateTime = currentTime;
  }
}

void processCommand(String cmd) {
  cmd.trim();
  
  if (cmd == "PING") {
    Serial.println("PONG");
  }
  else if (cmd == "GET") {
    sendStateUpdate();
  }
  else if (cmd.startsWith("SET ")) {
    // SET <pin> <value>
    int firstSpace = cmd.indexOf(' ');
    int secondSpace = cmd.indexOf(' ', firstSpace + 1);
    if (secondSpace > 0) {
      int pin = cmd.substring(firstSpace + 1, secondSpace).toInt();
      int value = cmd.substring(secondSpace + 1).toInt();
      
      // Find pin in digital array
      for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
        if (DIGITAL_PINS[i] == pin) {
          digitalWrite(pin, value ? HIGH : LOW);
          digitalStates[i] = value;
          sendStateUpdate();
          return;
        }
      }
      Serial.println("{\"error\":\"Invalid pin\"}");
    }
  }
  else if (cmd.startsWith("PIN ")) {
    // PIN <pin> <mode>
    int firstSpace = cmd.indexOf(' ');
    int secondSpace = cmd.indexOf(' ', firstSpace + 1);
    if (secondSpace > 0) {
      int pin = cmd.substring(firstSpace + 1, secondSpace).toInt();
      int mode = cmd.substring(secondSpace + 1).toInt();
      
      // Find pin in digital array
      for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
        if (DIGITAL_PINS[i] == pin) {
          if (mode == 0) {
            pinMode(pin, INPUT);
          } else if (mode == 1) {
            pinMode(pin, OUTPUT);
          } else if (mode == 2) {
            pinMode(pin, INPUT_PULLUP);
          }
          sendStateUpdate();
          return;
        }
      }
      Serial.println("{\"error\":\"Invalid pin\"}");
    }
  }
  else {
    Serial.println("{\"error\":\"Unknown command\"}");
  }
}

void sendStateUpdate() {
  // Read current states
  bool stateChanged = false;
  
  // Read digital pins
  for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
    int currentState = digitalRead(DIGITAL_PINS[i]);
    if (currentState != digitalStates[i]) {
      digitalStates[i] = currentState;
      stateChanged = true;
    }
  }
  
  // Read analog pins
  for (int i = 0; i < NUM_ANALOG_PINS; i++) {
    int currentState = analogRead(ANALOG_PINS[i]);
    if (abs(currentState - analogStates[i]) > 10) { // Threshold to reduce noise
      analogStates[i] = currentState;
      stateChanged = true;
    }
  }
  
  // Send JSON state
  Serial.print("{");
  
  // Digital pins
  for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
    Serial.print("\"D");
    Serial.print(DIGITAL_PINS[i]);
    Serial.print("\":");
    Serial.print(digitalStates[i]);
    if (i < NUM_DIGITAL_PINS - 1 || NUM_ANALOG_PINS > 0) {
      Serial.print(",");
    }
  }
  
  // Analog pins
  for (int i = 0; i < NUM_ANALOG_PINS; i++) {
    Serial.print("\"A");
    Serial.print(i);
    Serial.print("\":");
    Serial.print(analogStates[i]);
    if (i < NUM_ANALOG_PINS - 1) {
      Serial.print(",");
    }
  }
  
  Serial.println("}");
}
