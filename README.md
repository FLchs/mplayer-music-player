# Mplayer-lib

Mplayer-lib is a Typescript Mplayer wrapper for Nodejs

## Installation

Library is _not yet_ available on npm

```bash
npm install mplayerlib
```

## Usage

```typescript
import { Mplayer } from 'mplayerlib';

const mplayer = new Mplayer();

await mplayer.isReady();
```

## Documentation

Generate documentation :

```bash
npm run doc
```

Open documentation in browser :

```bash
npm run doc:open
```

Generate coverage and test results :

```bash
npm run coverage
```

Open coverage and test results :

```bash
npm run coverage:open
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

MIT ([LICENSE](LICENSE) or
http://opensource.org/licenses/MIT)
