
void setup() {
  Serial.begin(115200);
}

void loop() {
  int val = analogRead(A0);
  Serial.print("ANALOG_A0:");
  Serial.println(val);
  delay(50); // Polling at 20Hz
}
