# Game interativo por telefone com a Twilio

Este jogo game foi desenvolvido para fazer uso das tecnologias de Speech do Text conectada ao serviço de media streaming da Twilio e recebendo dados através de uma ligação telefônica.

O jogo é configurado a partir do arquivo game.js que possui as fases e respectivas palavras-chave. A pessoa participante do jogo pode ligar para um número Twilio que teve seu webhook configurado para a raiz dessa aplicação e ficará com uma música de espera até que o controlador do jogo dê início a partida.

Uma vez iniciado o jogo, novos jogadores não serão aceitos e ouvirão uma mensagem informando que o jogo já começou.

Utilize a url /level para iniciar, interromper e pular de nível. Ao fazer este controle, os participantes ouvirão as instruções por áudio em seus telefones.



## Quer rodar esta aplicação?

Antes de iniciar o programa você precisa realizar alguns procedimentos:
* Criar uma conta Twilio
* Criar uma conta da Google Cloud
* Ativar a API Google Speech to Text no console da Google Cloud
* Crie a credencial de acesso (conta de serviço) do Google e salve o arquivo json na pasta
* Preencher as variáveis do arquivo `.env.sample`
* Modificar o nome do arquivo de `.env.sample` para `.env`


Para rodar essa aplicação execute os seguintes comandos no seu terminal:
```
npm install
npm start
```


Lembre-se de que este serviço precisa ter uma URL pública acessível para configurar o webhook da Twilio. Utilize ferramentas como o Ngrok para disponibilizar seu link caso esteja rodando em um ambiente local.
