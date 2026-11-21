#pragma once

// Pareamento com a conta do produtor (ver api/src/modules/pairing).
//
// Sem dono, o aparelho gera uma chave própria (guardada na flash), se anuncia à API com o
// serial da etiqueta e, ao apertar o botão BOOT, abre a janela de pareamento de 5 min. Quando
// alguém o vincula no painel, a resposta traz o id e o aparelho passa a usar essa chave nos
// lotes. Segurar o botão por 10 s apaga o pareamento.

namespace pairing {

struct Credentials {
  char deviceId[65];
  char key[65];
};

/** Lê a flash e prepara a chave; imprime o serial na porta serial. Chame no setup(). */
void begin();

/** Anuncia quando preciso e acompanha o botão. Chame a cada volta do loop(). */
void loop();

/** O aparelho já tem dono? */
bool paired();

/** Id e chave para enviar lotes; false enquanto não houver dono. */
bool credentials(Credentials& out);

}  // namespace pairing
