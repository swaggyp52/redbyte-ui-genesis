
void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(12, OUTPUT);
}

void loop() {
  // Read physical button on D2 (active low)
  int btn = digitalRead(2);
  
  // Update LED on D12
  digitalWrite(12, btn == LOW ? HIGH : LOW);
  
  // Minimal delay to prevent serial flooding if we added serial
  delay(10); 
}
