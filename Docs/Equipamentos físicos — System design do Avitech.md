&#91;image: Logo Avitech\]

# Equipamentos físicos — System design do Avitech

Nov 12, 2026 · @daniel

O Avitech usa um ESP32 com um sensor DHT22 e um módulo de relé que liga um ventilador de 12 V quando a temperatura sobe. A montagem é feita em protoboard, sem solda, com duas fontes separadas: um carregador de 5 V para o ESP32 e uma fonte de 12 V só para o ventilador. Este documento define os equipamentos, as ligações, a montagem e os testes, para a equipe montar sem precisar decidir nada além do que está aqui.

## 1. Requisitos físicos

O hardware precisa medir a temperatura, ligar e desligar o ventilador sozinho e continuar funcionando mesmo sem internet. Os valores abaixo vêm do firmware e do banco de dados.

| Requisito | Valor |
| --- | --- |
| Faixa de temperatura medida | -10 a 60 °C (o banco rejeita valores fora dessa faixa) |
| Ligação do ventilador | a partir de 30 °C; desliga em 28 °C; mínimo de 60 s entre trocas |
| Alerta crítico | 35 °C ou mais com o ventilador ligado |
| Leitura do sensor | a cada 2 s ou mais; amostra fechada a cada 60 s (mediana de 3 leituras) |
| Rede | Wi-Fi 2,4 GHz; o controle do ventilador não depende dela |
| Autonomia de dados sem internet | 6 h (360 amostras) na flash do ESP32 |
| Funcionamento contínuo | 24 h por dia, em local seco e protegido |
| Falha-segura | 3 falhas seguidas do sensor deixam o ventilador ligado |

## 2. Lista de equipamentos

| Item | Especificação | Função | Qtd |
| --- | --- | --- | --- |
| Microcontrolador | ESP32 DevKit de 30 ou 38 pinos, Wi-Fi 2,4 GHz | Controle, buffer de dados, envio de lotes e alertas | 1 |
| Sensor | DHT22 em módulo de 3 pinos (VCC, DATA, GND) com pull-up embutido | Temperatura e umidade do ar | 1 |
| Resistor | 10 kΩ | Pull-up da linha de dados, usado só se o DHT22 for o de 4 pinos, sem módulo | 1 |
| Módulo de relé | 5 V, 1 canal | Liga e desliga o ventilador | 1 |
| Ventilador | 12 V pequeno, tipo cooler de PC, até 0,3 A | Renova o ar | 1 |
| Fonte | 12 V, 1 A | Alimenta só o ventilador | 1 |
| Carregador | Celular, 5 V, 1 A ou mais | Alimenta o ESP32 pela USB | 1 |
| Cabo USB | Com dados, não só de carga | Liga o carregador ao ESP32 e grava o firmware | 1 |
| Protoboard e jumpers | Protoboard com kit de jumpers | Montagem sem solda | 1 |
| Régua de tomadas | Com 2 tomadas ou mais | Liga o carregador e a fonte à tomada da parede | 1 |

## 3. Alimentação e consumo

O sistema usa duas fontes que não dividem o terra: o carregador de 5 V alimenta o ESP32 e o módulo de relé, e a fonte de 12 V alimenta só o ventilador. O relé isola os dois lados, porque apenas abre e fecha o fio positivo do ventilador.

| Fonte | Carga | Tensão | Corrente máxima | Folga |
| --- | --- | --- | --- | --- |
| Carregador 5 V (1 A ou mais) | ESP32 com Wi-Fi | 5 V | 0,25 A |  |
| Carregador 5 V (1 A ou mais) | Módulo de relé | 5 V | 0,08 A |  |
| Carregador 5 V (1 A ou mais) | DHT22 (pelo 3V3 do ESP32) | 3,3 V | 0,002 A |  |
| **Total no carregador** |  | 5 V | **0,33 A** | Cerca de 67 % |
| Fonte 12 V (1 A) | Ventilador | 12 V | 0,30 A | Cerca de 70 % |

## 4. Ligações e pinagem

O ESP32 usa apenas dois pinos de dados: GPIO 4 para o sensor e GPIO 26 para o relé.

| Pino do ESP32 | Liga em | Direção | Observação |
| --- | --- | --- | --- |
| GPIO 4 | DATA do DHT22 | entrada | O módulo de 3 pinos já tem pull-up; o sensor de 4 pinos leva o resistor de 10 kΩ entre VCC e DATA |
| GPIO 26 | IN do módulo de relé | saída | O nível que aciona o relé fica na constante `RELAY_ACTIVE_LEVEL` do firmware; a maioria dos módulos aciona em nível baixo |
| 3V3 | VCC do DHT22 | alimentação |  |
| VIN (5 V) | VCC do módulo de relé | alimentação | Vem do carregador pela USB |
| GND | GND do DHT22 e GND do módulo de relé | terra | GND comum do lado de 5 V |

Fiação da montagem:

| De | Para | Como |
| --- | --- | --- |
| Carregador de 5 V | Porta USB do ESP32 | Cabo USB de dados |
| VIN do ESP32 | VCC do módulo de relé | Jumper no protoboard |
| GND do ESP32 | GND do módulo de relé e GND do DHT22 | Jumpers no protoboard |
| 3V3 do ESP32 | VCC do DHT22 | Jumper |
| GPIO 4 do ESP32 | DATA do DHT22 | Jumper |
| GPIO 26 do ESP32 | IN do módulo de relé | Jumper |
| Fonte de 12 V (+) | Borne COM do módulo de relé | Fio no borne de parafuso |
| Borne NA do módulo de relé | Fio vermelho (+) do ventilador | Fio no borne de parafuso |
| Fio preto (-) do ventilador | Fonte de 12 V (-) | Fios unidos por borne ou conector |

A fonte de 12 V entrega a tensão por um plugue; para chegar ao relé e ao ventilador, usa-se um adaptador de plugue fêmea com borne de parafuso ou o cabo da fonte com os dois fios expostos. O ventilador usa só os fios vermelho (+) e preto (-); os fios de rotação e de controle (amarelo e azul) ficam sem ligação e isolados. O lado de 5 V e o lado de 12 V não têm GND em comum.

## 5. Montagem e posicionamento

A medição só serve se o sensor ler o ar do ambiente medido; por isso o sensor não fica junto da eletrônica nem do ventilador.

- **Sensor:** longe do jato do ventilador, de lâmpadas e da luz direta do sol, ligado por jumpers fêmea-macho de até 30 cm.
- **Protoboard, relé e fontes:** em local seco e protegido, longe de respingos e fora do alcance das aves.
- **Ventilador:** posicionado para movimentar o ar do ambiente, a pelo menos 30 cm do sensor e sem soprar direto nele.
- **Tensão da rede:** só chega até a régua de tomadas, ao carregador e à fonte de 12 V; nenhuma tensão de rede passa pelo módulo de relé.
- **Energia:** o carregador e a fonte de 12 V ficam em tomadas diferentes da régua.
- **Wi-Fi:** o ESP32 fica num ponto com sinal de -75 dBm ou melhor na rede de 2,4 GHz.

## 6. Comportamento em falha

O controle do ventilador não depende de rede, de nuvem nem de banco: só do ESP32, do sensor e do relé.

| Falha | O que acontece | Como é percebida |
| --- | --- | --- |
| Sensor desconectado ou com erro | Após 3 falhas seguidas o ventilador fica ligado (falha-segura) | Eventos sensor\_failure e, ao voltar a ler, sensor\_recovered, enviados no próximo lote |
| Wi-Fi ou internet fora | O controle segue normal; as amostras ficam por até 6 h no buffer em flash | Healthchecks alerta após 30 min sem lote |
| Queda de energia | Tudo desliga; ao voltar, o ESP32 reinicia sozinho e retoma o controle | Healthchecks alerta após 30 min sem lote |
| Fonte de 12 V desligada | O ESP32 segue comandando o relé, mas o ventilador não gira | A temperatura sobe e dispara o alerta crítico |
| ESP32 travado | O watchdog do firmware reinicia a placa | Lacuna nas leituras e, se persistir, alerta do Healthchecks |
| Reinicialização com relé que aciona em nível baixo | O ventilador liga durante o reinício, que é o lado seguro | Nenhuma |
| Temperatura de 35 °C ou mais com o ventilador ligado | O ESP32 avisa direto no Telegram, no máximo 1 vez a cada 15 min | Mensagem no Telegram e evento temp\_critical |
| Relé colado ou ventilador travado | O relé não devolve o estado real; a leitura registra o comando, não o estado do motor | A temperatura continua subindo e dispara o alerta crítico |

## 7. Testes de aceitação

Todos os testes passam antes de o equipamento entrar em uso.

| Teste | Como fazer | Resultado esperado |
| --- | --- | --- |
| Cabo USB de dados | Conectar o ESP32 ao computador e gravar o firmware | A placa aparece como porta serial e a gravação conclui |
| Tensões | Medir 5 V entre VIN e GND do ESP32 e 12 V nos fios da fonte | 5 V e 12 V, com variação de até 5 % |
| Isolamento | Medir continuidade entre o GND do ESP32 e o negativo da fonte de 12 V | Sem continuidade |
| Nível do relé | Comandar o GPIO 26 nos dois níveis | O relé estala e o ventilador gira só no nível de acionamento configurado em `RELAY_ACTIVE_LEVEL` |
| Sensor | Comparar o DHT22 com um termômetro de referência na mesma posição | Diferença de até 1 °C |
| Ligação do ventilador | Aquecer o sensor até 30 °C | O ventilador liga |
| Desligamento | Deixar o sensor esfriar até 28 °C | O ventilador desliga, respeitando os 60 s mínimos |
| Falha-segura | Desconectar o jumper de dados do sensor | Após 3 falhas o ventilador liga e o evento é registrado |
| Alerta crítico | Simular 35 °C ou mais com o ventilador ligado | Mensagem no Telegram, no máximo 1 a cada 15 min |
| Sem internet | Desligar o Wi-Fi por 1 h | O controle segue e, ao voltar a rede, as leituras do período chegam ao painel |
| Dispositivo mudo | Desligar o carregador por mais de 30 min | O Healthchecks envia o alerta no Telegram |
| Queda de energia | Desligar e religar a régua de tomadas | O sistema volta sozinho e retoma o controle |
