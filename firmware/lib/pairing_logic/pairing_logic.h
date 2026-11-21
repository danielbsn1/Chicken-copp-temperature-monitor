#pragma once

// Lógica do pareamento sem nenhuma dependência do Arduino: compila e é testada no PC
// (env:native). A parte que fala com Wi-Fi, flash e botão fica em src/pairing.cpp.

#include <stddef.h>
#include <stdint.h>

namespace pairing {

// Tamanhos (com o \0 no fim).
constexpr size_t SERIAL_LEN = 17;  // "AVT-" + 12 hexadecimais do MAC
constexpr size_t KEY_LEN = 65;     // 32 bytes em hexadecimal
constexpr size_t FW_LEN = 33;

// Tempos (ms). A API aceita 60 anúncios por minuto; ficamos bem abaixo disso.
constexpr uint32_t ANNOUNCE_INTERVAL_MS = 10000UL;
constexpr uint32_t ANNOUNCE_BACKOFF_MAX_MS = 60000UL;
// Segurar o botão por este tempo apaga o pareamento (volta a esperar um dono).
constexpr uint32_t RESET_HOLD_MS = 10000UL;

/** Serial da etiqueta, a partir do MAC: "AVT-" + 12 hexadecimais maiúsculos. */
void makeSerial(const uint8_t mac[6], char out[SERIAL_LEN]);

/** Bytes em hexadecimal minúsculo; `out` precisa de 2 * n + 1 posições. */
void toHex(const uint8_t* bytes, size_t n, char* out);

/** O serial tem 8 a 64 caracteres entre letras, números e hífen (igual ao da API). */
bool isValidSerial(const char* serial);

/** A chave tem exatamente 64 hexadecimais minúsculos (igual ao da API). */
bool isValidKey(const char* key);

/** A versão tem 1 a 63 caracteres sem aspas, barra invertida nem controle. */
bool isValidFirmware(const char* fw);

/**
 * Corpo JSON do anúncio: {"serial","key","fwVersion","button"}. Devolve o tamanho, ou 0 se
 * algum campo for inválido ou não couber em `cap` (nada é escrito pela metade).
 */
size_t buildAnnounceBody(char* buf, size_t cap, const char* serial, const char* key,
                         const char* fw, bool button);

/**
 * Endereço do anúncio a partir do da API de envio (".../api/ingest" -> ".../api/pairing/announce").
 * Devolve false se o endereço não termina em "/ingest" ou não couber.
 */
bool announceUrl(const char* ingestUrl, char* out, size_t cap);

/** Resposta da API ao anúncio. */
struct Reply {
  bool claimed = false;
  char deviceId[65] = {0};
};

/**
 * Decide quando anunciar de novo. O botão pedido pelo usuário anuncia já, com button=true; a
 * falha de rede espaça as tentativas (dobra até 60 s); o sucesso volta ao intervalo normal.
 * O tempo vem de fora (millis) e a conta aguenta a volta do contador.
 */
class Announcer {
 public:
  /** O usuário apertou o botão: anuncia já e, a partir daí, com button=true. */
  void pressButton(uint32_t now);
  /** Passou da hora de anunciar? */
  bool due(uint32_t now) const;
  /** O próximo anúncio leva o botão apertado? */
  bool buttonPending() const { return button_; }
  /** Registra o resultado de uma tentativa. */
  void done(uint32_t now, bool networkOk);
  /** A API recebeu o anúncio com o botão: o botão já cumpriu seu papel. */
  void buttonDelivered() { button_ = false; }

 private:
  uint32_t nextAt_ = 0;
  uint32_t interval_ = ANNOUNCE_INTERVAL_MS;
  bool button_ = false;
  bool started_ = false;
};

/** Mede quanto tempo o botão está seguro, para o apagar do pareamento. */
class HoldDetector {
 public:
  /** Chame a cada volta do loop com o estado atual do botão; true uma vez ao completar o tempo. */
  bool update(bool pressed, uint32_t now);
  /** O botão foi solto agora, depois de um aperto curto (menos que RESET_HOLD_MS)? */
  bool shortPressReleased() const { return shortPress_; }

 private:
  bool down_ = false;
  bool fired_ = false;
  bool shortPress_ = false;
  uint32_t since_ = 0;
};

}  // namespace pairing
