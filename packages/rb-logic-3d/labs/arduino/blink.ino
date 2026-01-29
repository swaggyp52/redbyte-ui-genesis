
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("PINS D13=1");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("PINS D13=0");
  delay(1000);
}
