#include "pairing.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_system.h>

#include "config.h"
#include "pairing_logic.h"
#include "secrets.h"

// A chave do aparelho trafega no anúncio, então a conexão precisa ser verificada contra o
// certificado raiz da API (API_ROOT_CA no secrets.h), nunca com setInsecure.

namespace pairing {

namespace {

constexpr const char* NAMESPACE = "avitech";
constexpr const char* KEY_DEVICE = "dev";
constexpr const char* KEY_SECRET = "key";
constexpr int HTTP_TIMEOUT_MS = 8000;

Preferences prefs;
Announcer announcer;
HoldDetector hold;
char serial[SERIAL_LEN];
char key[KEY_LEN];
char deviceId[65];
char url[160];
bool hasOwner = false;
bool urlOk = false;
bool caMissing = false;

void newKey() {
  uint8_t raw[32];
  esp_fill_random(raw, sizeof(raw));
  toHex(raw, sizeof(raw), key);
  prefs.putString(KEY_SECRET, key);
}

void loadOrCreate() {
  prefs.begin(NAMESPACE, false);
  String stored = prefs.getString(KEY_SECRET, "");
  if (isValidKey(stored.c_str())) {
    strlcpy(key, stored.c_str(), sizeof(key));
  } else {
    newKey();  // primeiro boot (ou flash corrompida): a chave nasce aqui e não muda mais
  }
  String dev = prefs.getString(KEY_DEVICE, "");
  hasOwner = dev.length() > 0 && dev.length() < sizeof(deviceId);
  if (hasOwner) strlcpy(deviceId, dev.c_str(), sizeof(deviceId));
}

/** Apaga o dono e troca a chave: o aparelho volta a se anunciar como novo. */
void reset() {
  prefs.remove(KEY_DEVICE);
  newKey();
  hasOwner = false;
  deviceId[0] = '\0';
  announcer = Announcer();
  Serial.println("[pairing] pareamento apagado; aguardando novo dono");
}

/** Um anúncio. Devolve true se a API respondeu (mesmo "aguardando"); false se falhou. */
bool announce(bool button, Reply& reply) {
  char body[256];
  if (buildAnnounceBody(body, sizeof(body), serial, key, FW_VERSION, button) == 0) {
    Serial.println("[pairing] corpo do anúncio inválido");
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(API_ROOT_CA);
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST((uint8_t*)body, strlen(body));
  if (code != 200) {
    Serial.printf("[pairing] anúncio recusado (HTTP %d)\n", code);
    http.end();
    return false;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getStream());
  http.end();
  if (err) return false;

  const char* status = doc["status"] | "";
  if (strcmp(status, "claimed") == 0) {
    const char* id = doc["deviceId"] | "";
    if (id[0] == '\0' || strlen(id) >= sizeof(reply.deviceId)) return false;
    reply.claimed = true;
    strlcpy(reply.deviceId, id, sizeof(reply.deviceId));
  } else if (doc["pairing"] | false) {
    Serial.println("[pairing] janela de pareamento aberta (5 min)");
  }
  return true;
}

}  // namespace

void begin() {
  pinMode(PIN_PAIR_BUTTON, INPUT_PULLUP);
  uint8_t mac[6];
  WiFi.macAddress(mac);
  makeSerial(mac, serial);
  loadOrCreate();
  urlOk = announceUrl(API_URL, url, sizeof(url));
  caMissing = strlen(API_ROOT_CA) == 0;
  Serial.printf("[pairing] serial: %s (%s)\n", serial,
                hasOwner ? "com dono" : "aguardando dono: aperte o botão BOOT");
  if (!urlOk) Serial.println("[pairing] API_URL precisa terminar em /ingest");
  if (caMissing) Serial.println("[pairing] API_ROOT_CA vazio no secrets.h: sem ele não há anúncio");
}

void loop() {
  uint32_t now = millis();
  bool pressed = digitalRead(PIN_PAIR_BUTTON) == LOW;
  if (hold.update(pressed, now) && hasOwner) reset();
  if (hold.shortPressReleased() && !hasOwner) {
    announcer.pressButton(now);
    Serial.println("[pairing] botão apertado");
  }

  if (hasOwner || !urlOk || caMissing || WiFi.status() != WL_CONNECTED || !announcer.due(now)) return;

  Reply reply;
  bool button = announcer.buttonPending();
  bool ok = announce(button, reply);
  announcer.done(millis(), ok);
  if (ok && button) announcer.buttonDelivered();
  if (ok && reply.claimed) {
    strlcpy(deviceId, reply.deviceId, sizeof(deviceId));
    prefs.putString(KEY_DEVICE, deviceId);
    hasOwner = true;
    Serial.printf("[pairing] vinculado como %s\n", deviceId);
  }
}

bool paired() { return hasOwner; }

bool credentials(Credentials& out) {
  if (!hasOwner) return false;
  strlcpy(out.deviceId, deviceId, sizeof(out.deviceId));
  strlcpy(out.key, key, sizeof(out.key));
  return true;
}

}  // namespace pairing
