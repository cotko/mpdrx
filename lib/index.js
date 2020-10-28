'use strict'
const debug = require('debug')(require('../package.json').name)
const mpdapi = require('mpd-api')
const playback = require('./playback')

const rx = require('rxjs')
const rxop = require('rxjs/operators')

const null$ = rx.of(null)

exports.connect = connConfig => mpdapi
  .connect(connConfig)
  .then(client => {
    const streams = getClientStreams(client)

    return { ...streams, client }
  })

const getClientStreams = client => {
  const streams = {}
  streams.event$ = getClientStream(client)
    .pipe(
      rxop.map(evt => evt.type === 'initial' ? 'initial' : evt.evt)
    )

  // get the status when needed
  streams.status$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'player', 'options', 'mixer'].indexOf(evt)),
      rxop.debounceTime(32),
      rxop.tap(() => debug('status$ changed')),
      rxop.mergeMap(() => client.api.status.get())
    )

  streams.state$ = streams.status$.pipe(
    rxop.map(status => status.state),
    rxop.distinctUntilChanged(),
    rxop.tap(state => debug('state$ %O', state))
  )

  streams.currentSong$ = streams.status$.pipe(
    rxop.map(status => status.songid),
    rxop.distinctUntilChanged(),
    rxop.tap(songid => debug('currentSong$ songid changed %s', songid)),
    rxop.mergeMap(songid => songid == null ? null$ : client.api.queue.id(songid)),
    rxop.map(song => song instanceof Array ? song[0] : song)
  )

  streams.currentSongUnique$ = streams.currentSong$.pipe(
    rxop.distinctUntilChanged((sa, sb) =>
      (sa && sb)
        ? sa.file === sb.file
        : JSON.stringify(sa) === JSON.stringify(sb)
    )
  )

  streams.playlists$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'stored_playlist'].indexOf(evt)),
      rxop.tap(() => debug('playlists$ changed')),
      rxop.debounceTime(32),
      rxop.mergeMap(() => client.api.playlists.get())
    )

  streams.message$ = streams.event$
    .pipe(
      rxop.filter(evt => evt === 'message'),
      rxop.tap(() => debug('message$ received')),
      rxop.mergeMap(() => client.api.c2c.readMessages())
    )

  streams.dbUpdate$ = streams.event$
    .pipe(
      rxop.filter(evt => evt === 'database'),
      rxop.tap(() => debug('dbUpdate$'))
    )

  streams.stats$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'database'].indexOf(evt)),
      rxop.tap(() => debug('stats$')),
      rxop.mergeMap(() => client.api.status.stats())
    )

  streams.partition$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'partition'].indexOf(evt)),
      rxop.tap(() => debug('partition$')),
      rxop.mergeMap(() => client.api.partition.list())
    )

  // just an event
  streams.sticker$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'sticker'].indexOf(evt)),
      rxop.tap(() => debug('sticker$'))
    )

  streams.subscription$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'subscription'].indexOf(evt)),
      rxop.tap(() => debug('subscription$')),
      rxop.mergeMap(() => client.api.c2c.list())
    )

  streams.neighbor$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'neighbor'].indexOf(evt)),
      rxop.tap(() => debug('neighbor$')),
      rxop.mergeMap(() => client.api.mounts.listNeighbors())
    )

  streams.mount$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'mount'].indexOf(evt)),
      rxop.tap(() => debug('mount$')),
      rxop.mergeMap(() => client.api.mounts.list())
    )

  streams.output$ = streams.event$
    .pipe(
      rxop.filter(evt => ~['initial', 'output'].indexOf(evt)),
      rxop.tap(() => debug('output$')),
      rxop.mergeMap(() => client.api.outputs.list())
    )

  playback.register(streams)

  return streams
}

const getClientStream = client => rx.Observable.create(observer => {
  const onEnd = () => {
    debug('getClientStream#onEnd() client connection lost')
    observer.complete()
  }

  const onErr = err => {
    debug('getClientStream#onErr()', err)
    observer.next({ type: 'error', err })
  }

  const onEvt = evt => {
    debug('getClientStream#onEvt() system:', evt)
    observer.next({ type: 'system', evt })
  }

  client.on('close', onEnd)
  client.on('error', onErr)
  client.on('system', onEvt)

  observer.next({ type: 'initial' })

  return () => {
    client.removeListener('system', onEvt)
    client.removeListener('end', onEnd)
    client.removeListener('error', onErr)
  }
})

exports.default = exports.connect
