#include <Arduino.h>
#include <WiFi.h>

#include "config.h"
#include "pairing.h"
#include "secrets.h"

// Fase 1: controle (millis, histerese, fail-safe) e tarefa de rede.
// Por enquanto: só o Wi-Fi (a tarefa de rede vai substituir este trecho) e o pareamento.
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  pairing::begin();
}

void loop() { pairing::loop(); }
