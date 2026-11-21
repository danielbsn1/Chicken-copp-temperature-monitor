#include "pairing_logic.h"

#include <stdio.h>
#include <string.h>

namespace pairing {

static const char HEX[] = "0123456789abcdef";

void toHex(const uint8_t* bytes, size_t n, char* out) {
  for (size_t i = 0; i < n; i++) {
    out[2 * i] = HEX[bytes[i] >> 4];
    out[2 * i + 1] = HEX[bytes[i] & 0x0F];
  }
  out[2 * n] = '\0';
}

void makeSerial(const uint8_t mac[6], char out[SERIAL_LEN]) {
  static const char UP[] = "0123456789ABCDEF";
  out[0] = 'A';
  out[1] = 'V';
  out[2] = 'T';
  out[3] = '-';
  for (int i = 0; i < 6; i++) {
    out[4 + 2 * i] = UP[mac[i] >> 4];
    out[5 + 2 * i] = UP[mac[i] & 0x0F];
  }
  out[16] = '\0';
}

bool isValidSerial(const char* serial) {
  if (!serial) return false;
  size_t n = strlen(serial);
  if (n < 8 || n > 64) return false;
  for (size_t i = 0; i < n; i++) {
    char c = serial[i];
    bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
              c == '-';
    if (!ok) return false;
  }
  return true;
}

bool isValidKey(const char* key) {
  if (!key || strlen(key) != 64) return false;
  for (size_t i = 0; i < 64; i++) {
    char c = key[i];
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

bool isValidFirmware(const char* fw) {
  if (!fw) return false;
  size_t n = strlen(fw);
  if (n < 1 || n > 63) return false;
  for (size_t i = 0; i < n; i++) {
    unsigned char c = (unsigned char)fw[i];
    if (c < 0x20 || c == '"' || c == '\\' || c == 0x7F) return false;
  }
  return true;
}

size_t buildAnnounceBody(char* buf, size_t cap, const char* serial, const char* key,
                         const char* fw, bool button) {
  if (!buf || !isValidSerial(serial) || !isValidKey(key) || !isValidFirmware(fw)) return 0;
  // Valida primeiro e só então escreve: snprintf devolve o tamanho que precisaria.
  int needed = snprintf(nullptr, 0,
                        "{\"serial\":\"%s\",\"key\":\"%s\",\"fwVersion\":\"%s\",\"button\":%s}",
                        serial, key, fw, button ? "true" : "false");
  if (needed <= 0 || (size_t)needed + 1 > cap) return 0;
  snprintf(buf, cap, "{\"serial\":\"%s\",\"key\":\"%s\",\"fwVersion\":\"%s\",\"button\":%s}",
           serial, key, fw, button ? "true" : "false");
  return (size_t)needed;
}

bool announceUrl(const char* ingestUrl, char* out, size_t cap) {
  static const char SUFFIX[] = "/ingest";
  static const char TARGET[] = "/pairing/announce";
  if (!ingestUrl || !out) return false;
  size_t n = strlen(ingestUrl);
  size_t s = sizeof(SUFFIX) - 1;
  if (n < s || strcmp(ingestUrl + n - s, SUFFIX) != 0) return false;
  size_t base = n - s;
  if (base + sizeof(TARGET) > cap) return false;
  memcpy(out, ingestUrl, base);
  memcpy(out + base, TARGET, sizeof(TARGET));
  return true;
}

// Diferença com sinal: vale mesmo quando o contador de 32 bits dá a volta (a cada ~49 dias).
static bool reached(uint32_t now, uint32_t at) { return (int32_t)(now - at) >= 0; }

void Announcer::pressButton(uint32_t now) {
  button_ = true;
  started_ = true;
  nextAt_ = now;
  interval_ = ANNOUNCE_INTERVAL_MS;
}

bool Announcer::due(uint32_t now) const {
  // O primeiro anúncio sai logo que o aparelho conecta.
  return !started_ || reached(now, nextAt_);
}

void Announcer::done(uint32_t now, bool networkOk) {
  started_ = true;
  if (networkOk) {
    interval_ = ANNOUNCE_INTERVAL_MS;
  } else {
    interval_ = interval_ * 2 > ANNOUNCE_BACKOFF_MAX_MS ? ANNOUNCE_BACKOFF_MAX_MS : interval_ * 2;
  }
  nextAt_ = now + interval_;
}

bool HoldDetector::update(bool pressed, uint32_t now) {
  shortPress_ = false;
  if (pressed) {
    if (!down_) {
      down_ = true;
      fired_ = false;
      since_ = now;
    }
    if (!fired_ && (uint32_t)(now - since_) >= RESET_HOLD_MS) {
      fired_ = true;
      return true;
    }
    return false;
  }
  if (down_ && !fired_ && (uint32_t)(now - since_) >= 50) shortPress_ = true;  // 50 ms: ignora ruído
  down_ = false;
  return false;
}

}  // namespace pairing
