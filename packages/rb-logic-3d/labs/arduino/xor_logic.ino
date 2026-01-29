
void setup() {
  pinMode(8, INPUT);
  pinMode(9, INPUT);
  pinMode(10, OUTPUT);
}

void loop() {
  int in1 = digitalRead(8);
  int in2 = digitalRead(9);
  digitalWrite(10, in1 ^ in2);
  delay(1); 
}
