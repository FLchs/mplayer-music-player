import { expect } from 'earljs';
import { after, describe, it } from 'mocha';
import path from 'path';

import { Mplayer } from '..';

const workingConf: Config = {
  executable: 'mplayer',
  args: ['-idle', '-slave', '-msglevel', 'statusline=-1', '-novideo'],
};
const incorrectConf: Config = {
  executable: 'null',
  args: ['-idle', '-slave', '-msglevel', 'statusline=-1', '-novideo'],
};

describe('Process management', () => {
  const players: Mplayer[] = [];
  after(() => {
    players.forEach((player) => player.exit());
  });
  describe('Working configuration', () => {
    it('Spawn instance', () => {
      const player = new Mplayer(workingConf);
      players.push(player);
      expect(player.instance.pid).toBeGreaterThan(0);
    });
    it('Becomes ready', async () => {
      const player = new Mplayer(workingConf);
      players.push(player);
      await player.isReady();
    });
    it('Exits cleanly', async () => {
      const player = new Mplayer(workingConf);
      players.push(player);
      await player.isReady();
      await player.exit();
      expect(player.instance.signalCode).toEqual('SIGINT');
      expect(player.instance.killed).toEqual(true);
    });
  });

  describe('Incorrect configuration', () => {
    it('Emmit error', () => {
      const player = new Mplayer(incorrectConf);
      players.push(player);
      player.once('error', (err) => {
        expect(err.message).toEqual(expect.stringMatching(`spawn ${incorrectConf.executable} ENOENT`));
      });
    });
    it("Doesn't become ready", async () => {
      const player = new Mplayer(incorrectConf);
      players.push(player);
      await expect(player.isReady()).toBeRejected();
    });
  });
});

describe('File loading', () => {
  const players: Mplayer[] = [];
  after(() => {
    players.forEach((player) => player.exit());
  });
  it('Opens music file', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    expect(player.getStatus()).toEqual('playing');
  });
});

describe('Playing control', () => {
  const players: Mplayer[] = [];
  after(() => {
    players.forEach((player) => player.exit());
  });
  it('Pause playing', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    // Pause player
    await player.pause();
    expect(player.getStatus()).toEqual('paused');
    // Second pause does nothing
    await player.pause();
    expect(player.getStatus()).toEqual('paused');
  });

  it('Resume playing', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    // Pause player
    await player.pause();
    expect(player.getStatus()).toEqual('paused');
    // Resume playing
    await player.resume();
    expect(player.getStatus()).toEqual('playing');
    // Second resume does nothing
    await player.resume();
    expect(player.getStatus()).toEqual('playing');
  });

  it('Stop playing', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    // Pause player
    await player.stop();
    expect(player.getStatus()).toEqual('stopped');
    // Second pause does nothing
    await player.stop();
    expect(player.getStatus()).toEqual('stopped');
  });
});

describe('Track info', () => {
  const players: Mplayer[] = [];
  after(() => {
    players.forEach((player) => player.exit());
  });
  it('Return track infos correctly', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    expect(await player.getTrackInfos()).toEqual({
      Album: 'First Album',
      Artist: 'Best Band Ever',
      Title: 'Sample 1',
    });
  });
  it('Get track playing progress', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    expect(await player.getProgress()).toEqual({
      time: expect.a(Number),
      percent: expect.a(Number),
      total: expect.a(Number),
    });
  });
  it('Get consistent playing progress', async () => {
    const player = new Mplayer(workingConf);
    players.push(player);
    await player.isReady();
    await player.play(path.resolve('src/tests/music/sample1.flac'));
    const initProgress = await player.getProgress();
    await new Promise<void>((res) =>
      setTimeout(() => {
        res();
      }, 50)
    );
    expect(await player.getProgress()).toEqual({
      percent: expect.numberGreaterThanOrEqualTo(initProgress.percent),
      time: expect.numberGreaterThan(initProgress.time) && expect.numberCloseTo(initProgress.time, { delta: 0.5 }),
      total: initProgress.total,
    });
  });
});
