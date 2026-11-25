# Estúdio Criativo Cortes

Edição personalizada mantida por **@erichpereira22**, para criar cortes de vídeos e lives, com interface escura em verde neon e processamento local.

## Instalação no Windows

Baixe **Instalar-Estudio-Criativo-Cortes.exe** na [última release](https://github.com/erichpereira1996/estudio-criativo-cortes/releases/latest), execute e clique em **Instalar agora**. O pacote inclui as ferramentas e os modelos de transcrição base e small. Não é necessário instalar Node.js ou Python separadamente. Requer Windows 10/11 x64 e Edge ou Chrome para a janela do app.

Vídeos locais podem ser processados sem internet; links e lives precisam de conexão. Modelos adicionais podem exigir download. O instalador é por usuário e cria atalhos no menu Iniciar e, opcionalmente, na área de trabalho. A desinstalação preserva dados e presets.

## Uso pelo código-fonte no Windows

1. Execute `instalar.bat` para preparar as dependências.
2. Execute `iniciar.bat` para abrir o programa.
3. Escolha um vídeo ou link, ajuste o enquadramento e gere os cortes.

Para iniciar com Node.js instalado: `npm start`.

A transcrição, a seleção dos momentos e a geração dos cortes usam os recursos locais do computador. Downloads de vídeos, lives, modelos e ferramentas podem exigir internet.

## Esta edição

- Nome e ícone próprios, com destaques em verde neon.
- Sem assinaturas, testes pagos, checkout, ativação ou serviços de IA Pro.
- As atualizações automáticas do projeto original estão desativadas para preservar esta edição.
- Instalador próprio para Windows, com interface escura e verde neon.

## Licença e origem

Edição independente. A origem do código está documentada em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

O código original permanece sob a [licença MIT](LICENSE), com seu aviso de copyright preservado em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). As licenças dos componentes de terceiros também são mantidas.

## Vinheta e marca d’água

Abra **Identidade** no topo ou **Configurar identidade** na geração de cortes.

- Vinheta: MP4, MOV ou WebM com pelo menos 2 segundos, até 100 MB. São usados os primeiros 2 segundos, com áudio quando presente. Escolha início ou fim; esses 2 segundos são acrescentados ao conteúdo.
- Marca d’água: PNG, JPG ou WebP até 10 MB. Ajuste pela prévia, pelos atalhos ou pelos controles de posição, tamanho, opacidade e margem. A opção “também na vinheta” estende a marca à abertura/encerramento.
- Clique em **Salvar identidade**. As escolhas valem para novos projetos e novos cortes da live. Ao reeditar um corte, preservamos a identidade original daquele corte e usamos o vídeo-fonte, sem duplicar a vinheta.
- Arquivos de identidade ficam junto da configuração do usuário, fora das pastas temporárias. A identidade é opcional; quando ativada, adiciona uma etapa de exportação.

## Versões

A numeração usa **SemVer**, no formato **v1.0.0** (major.minor.patch), começando em **v1.0.0** nesta migração. O prefixo `v` é usado na interface; o pacote guarda `1.0.0`. Interface e instalador leem a mesma versão de `package.json`.

Prepare cada lançamento conforme o tipo de mudança:

- `npm run version:next -- patch`: correções compatíveis, por exemplo v1.0.0 → v1.0.1. É o padrão quando nenhum tipo é informado.
- `npm run version:next -- minor`: funcionalidades compatíveis, por exemplo v1.0.1 → v1.1.0.
- `npm run version:next -- major`: mudanças incompatíveis, por exemplo v1.1.0 → v2.0.0.

Pacote e lock são atualizados juntos. Reinicie o app para carregar a versão nova. Abrir o programa ou rodar testes não incrementa a versão.

O instalador deve ser gerado por `node instalador/montar.js`; ele recebe a versão do pacote e gera os metadados do executável automaticamente. A distribuição de atualizações continua manual nesta edição.

## Verificação

`npm test` executa testes de configuração, versionamento e exportação com FFmpeg. É necessário ter FFmpeg e FFprobe instalados; caminhos personalizados podem ser informados em `FFMPEG_PATH` e `FFPROBE_PATH`.

Na janela Identidade, **Resetar identidade** desativa as duas opções, remove os anexos da configuração e restaura posição, tamanho, opacidade e margem. Clique em **Salvar identidade** para confirmar ou em **Cancelar** para restaurar a configuração anterior. Arquivos usados por projetos existentes são preservados para permitir sua reedição.

### Presets de identidade

Ao abrir ou recarregar o app, a identidade começa limpa. No painel Identidade, use **Salvar como preset** para guardar os anexos e parâmetros com um nome. Selecione um preset, clique em **Carregar** e depois em **Salvar identidade** para aplicá-lo aos próximos cortes nesta abertura. Excluir um preset não apaga arquivos utilizados em projetos anteriores.

## Compilar o instalador

No Windows x64, instale Python 3.12 e Pillow (`python -m pip install Pillow==13.0.0`), e mantenha os modelos base e small em `modelos/`. Execute `node instalador/montar.js`. A montagem valida o Python embarcado, gera a identidade visual e compila o pacote com Inno Setup. O resultado fica em `instalador/dist/Instalar-Estudio-Criativo-Cortes.exe`. O workflow do GitHub também gera o instalador ao publicar uma tag `v*`.
