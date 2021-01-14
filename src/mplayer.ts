import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'eventemitter3';
import { PathLike } from 'fs';

class Mplayer extends EventEmitter<EventTypes> {
  /**
   * The childprocess is spawned by Nodejs
   *
   * @type {ChildProcessWithoutNullStreams}
   * @memberof Mplayer
   */
  public instance: ChildProcessWithoutNullStreams;

  private ready: boolean;

  private status: 'playing' | 'paused' | 'stopped';

  /**
   *Creates an instance of Mplayer.
   * @param {Config} config
   * @memberof Mplayer
   */
  constructor(config: Config) {
    super();
    this.ready = false;
    this.status = 'stopped';
    this.instance = spawn(config.executable, config.args, {});
    this.instance.stdout.on('data', this.parseData.bind(this));
    this.instance.stderr.on('data', this.parseError.bind(this));
    this.instance.on('error', this.parseInstanceError.bind(this));
  }

  /**
   * Wait for the player to be ready
   *
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async isReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ready) {
        resolve();
      }
      this.once('ready', (event) => {
        if (event.error) {
          reject(event.error);
        }
        resolve();
      });
    });
  }

  /**
   * Get the status of the player
   *
   * @returns {('playing' | 'paused' | 'stopped')}
   * @memberof Mplayer
   */
  public getStatus(): 'playing' | 'paused' | 'stopped' {
    return this.status;
  }

  public async getTrackInfos(): Promise<TrackInfo> {
    const trackInfo: TrackInfo = {};
    return new Promise((resolve, reject) => {
      // Pause the stream
      this.instance.stdout.pause();
      this.sendCommand('get_meta_artist\nget_meta_album\nget_meta_title');
      // Poll data
      const refresh = setInterval(() => {
        if (this.instance.stdout.readableLength > 0) {
          const stdout = this.instance.stdout.read().toString();
          if (stdout.indexOf('ANS_ERROR=PROPERTY_UNKNOWN') !== -1) {
            this.instance.stdout.resume();
            reject(new Error('Failled to get propery'));
          }
          trackInfo.Artist = stdout.match("ANS_META_ARTIST='(.*)'")?.[1];
          trackInfo.Album = stdout.match("ANS_META_ALBUM='(.*)'")?.[1];
          trackInfo.Title = stdout.match("ANS_META_TITLE='(.*)'")?.[1];
          this.instance.stdout.resume();
          clearInterval(refresh);
          resolve(trackInfo);
        }
      }, 100);
    });
  }

  public async getProgress(): Promise<Progress> {
    return new Promise((resolve, reject) => {
      // Pause the stream
      this.instance.stdout.pause();
      this.sendCommand('get_percent_pos\nget_time_pos\nget_time_length');
      // Poll data
      const refresh = setInterval(() => {
        if (this.instance.stdout.readableLength > 0) {
          const stdout = this.instance.stdout.read().toString();
          if (stdout.indexOf('ANS_ERROR=PROPERTY_UNKNOWN') !== -1) {
            this.instance.stdout.resume();
            reject(new Error('Failled to get propery'));
          }
          const progress: Progress = {
            percent: parseFloat(stdout.match('ANS_PERCENT_POSITION=(.*)')?.[1]),
            time: parseFloat(stdout.match('ANS_TIME_POSITION=(.*)')?.[1]),
            total: parseFloat(stdout.match('ANS_LENGTH=(.*)')?.[1]),
          };
          this.instance.stdout.resume();
          clearInterval(refresh);
          resolve(progress);
        }
      }, 100);
    });
  }

  /**
   * Exit Mplayer
   *
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async exit(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isReady()
        .then(() => {
          this.instance.kill(2);
          this.instance.once('exit', () => {
            resolve();
          });
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  // File management

  /**
   * Load and play a new file either by replacing the current playing file or by
   * appending it to the playlist
   *
   * @param {PathLike} path
   * @param {boolean} [append=false]
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async play(path: PathLike, append = false): Promise<void> {
    return new Promise((resolve, reject) => {
      this.once('playing', (event) => {
        if (event.error) {
          reject(event.error);
        }
        resolve();
      });
      // Either switch to new file or add it to the playlist
      this.sendCommand(`loadfile "${path}" ${append ? 1 : ''}`);
    });
  }

  /**
   * Pause the player
   *
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async pause(): Promise<void> {
    return new Promise((resolve, reject) => {
      // First check if player is not already paused
      if (this.status === 'paused') {
        resolve();
      }
      // Wait for the status to change to paused
      this.once('statusChange', (event) => {
        if (event.error) {
          reject(event.error);
        }
        if (event.data === 'paused') {
          resolve();
        }
        reject(event.data);
      });
      this.sendCommand('pausing_keep_force pause');
    });
  }

  /**
   * Resume playing
   *
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async resume(): Promise<void> {
    return new Promise((resolve, reject) => {
      // First check if the player is not already playing
      if (this.status === 'playing' || this.status === 'stopped') {
        resolve();
      }
      // Send pause command to resume
      this.sendCommand('pause');
      // As there is no output on resuming, we have to check the pause property
      this.sendCommand('pausing_keep_force get_property pause');
      // Then resolve the promise once we are sure the player resumed playing
      this.once('statusChange', (event) => {
        if (event.error) {
          reject(event.error);
        }
        if (event.data === 'playing') {
          resolve();
        }
        reject(event.data);
      });
    });
  }

  /**
   * Stop player
   *
   * @returns {Promise<void>}
   * @memberof Mplayer
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.status === 'stopped') {
        resolve();
      } else {
        this.sendCommand('stop');
        this.status = 'stopped';
        this.emit('statusChange', { data: 'stopped' });
        resolve();
      }
    });
  }

  /**
   * Send command to stdin
   *
   * @private
   * @param {string} command
   * @memberof Mplayer
   */
  private sendCommand(command: string) {
    this.instance.stdin.write(`${command}\n`);
  }

  /**
   * Parse stderr
   *
   * @private
   * @param {ProcessError} err
   * @memberof Mplayer
   */
  private parseInstanceError(err: ProcessError): void {
    if (err.errno === -2) {
      this.emit('ready', { error: err });
    }
    this.emit('error', new Error(err.message));
  }

  /**
   * Parse stdout and emmit event accordingly
   *
   * @private
   * @param {Buffer} data
   * @memberof Mplayer
   */
  private parseData(data: Buffer): void {
    const dataStr = data.toString();
    // console.log(dataStr);

    // Once first output is 'MPlayer', MPlayer is considered ready to receive commands
    if (dataStr.indexOf('MPlayer') !== -1) {
      this.emit('ready', {});
      this.ready = true;
    }

    // Playing status
    if (dataStr.indexOf('Starting playback...') !== -1) {
      this.status = 'playing';
      this.emit('playing', {});
    }

    if (dataStr.indexOf('=====  PAUSE  =====') !== -1 || dataStr.indexOf('ANS_pause=yes') !== -1) {
      this.status = 'paused';
      this.emit('statusChange', { data: 'paused' });
    }

    if (dataStr.indexOf('ANS_pause=no') !== -1 && this.status !== 'stopped') {
      this.status = 'playing';
      this.emit('statusChange', { data: 'playing' });
    }
  }

  private parseError(data: Buffer): void {
    const dataStr = data.toString();
    // console.log(dataStr);

    // Once first output is 'MPlayer', MPlayer is considered ready to receive commands
    if (dataStr.indexOf('Failed to get value of property') !== -1) {
      // console.log(dataStr);
      const propName = dataStr.match('Failed to get value of property (.*)')?.[1] || 'unknown';
      this.emit('error', { message: 'Property unknown', name: propName });
      this.ready = true;
    }
  }
}

export { Mplayer };
