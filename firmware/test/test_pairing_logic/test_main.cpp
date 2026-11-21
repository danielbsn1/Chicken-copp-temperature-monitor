// Testes no PC com Unity: pio test -e native
#include <string.h>
#include <unity.h>

#include "pairing_logic.h"

#define CHECK(cond) TEST_ASSERT_TRUE(cond)

void setUp() {}
void tearDown() {}

using namespace pairing;

static const char KEY[] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

static void test_serial_e_hex() {
  const uint8_t mac[6] = {0x24, 0x0A, 0xC4, 0x00, 0xBE, 0xEF};
  char serial[SERIAL_LEN];
  makeSerial(mac, serial);
  CHECK(strcmp(serial, "AVT-240AC400BEEF") == 0);
  CHECK(isValidSerial(serial));

  const uint8_t bytes[3] = {0x00, 0xAB, 0xFF};
  char hex[7];
  toHex(bytes, 3, hex);
  CHECK(strcmp(hex, "00abff") == 0);
}

static void test_validacoes() {
  CHECK(isValidSerial("AVT-0001-XYZ"));
  CHECK(!isValidSerial("curto"));
  CHECK(!isValidSerial("AVT 0001 XYZ"));
  CHECK(!isValidSerial(nullptr));
  char longo[70];
  memset(longo, 'A', 69);
  longo[69] = '\0';
  CHECK(!isValidSerial(longo));

  CHECK(isValidKey(KEY));
  CHECK(!isValidKey("aaaa"));
  CHECK(!isValidKey("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
  CHECK(!isValidKey(nullptr));

  CHECK(isValidFirmware("2.0.1"));
  CHECK(!isValidFirmware(""));
  CHECK(!isValidFirmware("2.0\"1"));
  CHECK(!isValidFirmware("2.0\\1"));
  CHECK(!isValidFirmware("2.0\n1"));
}

static void test_corpo() {
  char buf[256];
  size_t n = buildAnnounceBody(buf, sizeof(buf), "AVT-0001-XYZ", KEY, "2.0.1", false);
  CHECK(n == strlen(buf));
  CHECK(strstr(buf, "\"serial\":\"AVT-0001-XYZ\"") != nullptr);
  CHECK(strstr(buf, "\"fwVersion\":\"2.0.1\"") != nullptr);
  CHECK(strstr(buf, "\"button\":false}") != nullptr);

  buildAnnounceBody(buf, sizeof(buf), "AVT-0001-XYZ", KEY, "2.0.1", true);
  CHECK(strstr(buf, "\"button\":true}") != nullptr);

  // Não cabe: nada é escrito pela metade.
  char pequeno[40];
  memset(pequeno, 'x', sizeof(pequeno));
  CHECK(buildAnnounceBody(pequeno, sizeof(pequeno), "AVT-0001-XYZ", KEY, "2.0.1", true) == 0);
  CHECK(pequeno[0] == 'x');

  // Campo inválido.
  CHECK(buildAnnounceBody(buf, sizeof(buf), "x", KEY, "2.0.1", true) == 0);
  CHECK(buildAnnounceBody(buf, sizeof(buf), "AVT-0001-XYZ", "chave", "2.0.1", true) == 0);
  CHECK(buildAnnounceBody(buf, sizeof(buf), "AVT-0001-XYZ", KEY, "a\"b", true) == 0);
}

static void test_url() {
  char out[128];
  CHECK(announceUrl("https://x.vercel.app/api/ingest", out, sizeof(out)));
  CHECK(strcmp(out, "https://x.vercel.app/api/pairing/announce") == 0);
  CHECK(!announceUrl("https://x.vercel.app/api/outra", out, sizeof(out)));
  CHECK(!announceUrl("ingest", out, 4));
  char curto[10];
  CHECK(!announceUrl("https://x.vercel.app/api/ingest", curto, sizeof(curto)));
}

static void test_announcer() {
  Announcer a;
  CHECK(a.due(0));  // o primeiro sai logo
  a.done(0, true);
  CHECK(!a.due(9999));
  CHECK(a.due(10000));

  // Falha de rede: dobra até 60 s e volta ao normal no sucesso.
  a.done(10000, false);
  CHECK(!a.due(10000 + 19999));
  CHECK(a.due(10000 + 20000));
  a.done(30000, false);
  a.done(70000, false);
  a.done(130000, false);
  CHECK(!a.due(130000 + 59999));
  CHECK(a.due(130000 + 60000));
  a.done(190000, true);
  CHECK(a.due(190000 + 10000));
  CHECK(!a.due(190000 + 9999));

  // Botão: anuncia já e leva button até a API confirmar.
  a.pressButton(200000);
  CHECK(a.buttonPending());
  CHECK(a.due(200000));
  a.buttonDelivered();
  CHECK(!a.buttonPending());
}

static void test_volta_do_contador() {
  Announcer a;
  uint32_t perto = 0xFFFFFFFFu - 4000;  // 4 s antes da volta
  a.done(perto, true);
  CHECK(!a.due(perto + 9999));
  CHECK(a.due(perto + 10000));  // cruza o zero e continua certo
}

static void test_hold() {
  HoldDetector h;
  CHECK(!h.update(false, 0));
  // Aperto curto.
  CHECK(!h.update(true, 1000));
  CHECK(!h.update(true, 1500));
  CHECK(!h.update(false, 1600));
  CHECK(h.shortPressReleased());
  CHECK(!h.update(false, 1700));
  CHECK(!h.shortPressReleased());

  // Ruído de menos de 50 ms não conta.
  CHECK(!h.update(true, 2000));
  CHECK(!h.update(false, 2020));
  CHECK(!h.shortPressReleased());

  // Aperto longo: dispara uma vez aos 10 s e não vira aperto curto ao soltar.
  CHECK(!h.update(true, 3000));
  CHECK(!h.update(true, 3000 + RESET_HOLD_MS - 1));
  CHECK(h.update(true, 3000 + RESET_HOLD_MS));
  CHECK(!h.update(true, 3000 + RESET_HOLD_MS + 500));
  CHECK(!h.update(false, 3000 + RESET_HOLD_MS + 600));
  CHECK(!h.shortPressReleased());
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_serial_e_hex);
  RUN_TEST(test_validacoes);
  RUN_TEST(test_corpo);
  RUN_TEST(test_url);
  RUN_TEST(test_announcer);
  RUN_TEST(test_volta_do_contador);
  RUN_TEST(test_hold);
  return UNITY_END();
}
