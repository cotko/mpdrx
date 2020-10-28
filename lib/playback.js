'use strict'
const rx = require('rxjs')
const rxop = require('rxjs/operators')
const debug = require('debug')(`${require('../package.json').name}:playback`)

exports.register = (streams) => {
  // Collect state changes with timestamps into a buffer.
  // Buffer flush is either `stop` state or song change.
  // Caluclate a playtime from collected "events"

  const status$ = streams.status$.pipe(
    rxop.share()
  )

  const song$ = streams.currentSong$.pipe(
    rxop.filter(song => song !== null),
    rxop.share()
  )

  const statusTime$ = status$.pipe(
    rxop.map(({ state, songid }) => ({ state, songid, ts: Date.now() })),
    rxop.distinctUntilChanged((a, b) =>
      a.state === b.state && a.songid === b.songid
    ),
    rxop.tap(ts => debug('statusTime$ %O', ts)),
    rxop.share()
  )

  // begin with current song and timestamp
  // and then switch to stateTs stream
  const songWithTS$ = rx
    .combineLatest(
      song$,
      statusTime$
    )
    .pipe(
      rxop.switchMap(
        ([song, statusTime]) => statusTime$
          .pipe(
            rxop.startWith(statusTime),
            rxop.map(
              statusTime => ({ ...statusTime, song })
            )
          )
      ),
      rxop.filter(({ song, songid }) => song.id === songid),
      rxop.tap(({ song, ...rest }) => debug('songWithTS$ %O ', { ...rest, song: { file: song.file, '...': '...' } })),
      rxop.share()
    )

  const playbackBufferFlush$ = rx
    // skip first updates from both streams
    .merge(
      song$.pipe(
        rxop.skip(1),
        rxop.mapTo('song')
      ),
      statusTime$.pipe(
        rxop.skip(1),
        rxop.filter(({ state }) => state === 'stop'),
        rxop.mapTo('state')
      )
    )
    .pipe(
      rxop.tap(which => debug('songChangedOrPlaybackStopped$ %o', which)),
      rxop.share()
    )

  streams.playback$ = songWithTS$.pipe(
    rxop.buffer(
      playbackBufferFlush$
    ),

    // add last timestamp after buffer flush
    rxop.map(values => ([...values, { ts: Date.now() }])),
    rxop.map(calculatePlayback)
  )
}

const calculatePlayback = values => values
  .reduce((memo, evt) => {
    const { ts, ...rest } = memo

    if (rest.song === undefined) {
      rest.song = evt.song
    }

    if (evt.state === 'play') {
      return { ...rest, ts: evt.ts }
    } else if (evt.state === 'stop') {
      return { ...rest, ts }
    }

    const { playback } = memo

    return {
      ...rest,
      playback: ts !== undefined ? playback + (evt.ts - ts) : playback
    }
  }, { playback: 0 })
