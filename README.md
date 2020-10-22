## node mpd client as RX.JS streams

Uses [mpd-api module](https://github.com/cotko/mpd-api) and exposes a few streams to subscribe to.

### Usage

  ```
  npm i / yarn add mpd-api
  ```

  ```js
  const log = tag => console.log.bind(console, tag)
  const streams = await cl.connect()

  const {
    client, // reference to 'mpd-api' client
    event$,
    status$,
    currentSong$,
    currentSongUnique$,
    playlists$,
    message$,
    dbUpdate$,
    stats$,
    partition$,
    sticker$,
    subscription$,
    neighbor$,
    mount$,
    output$,
  } = streams

  event$.subscribe(log('event'))
  status$.subscribe(log('status'))

  // unique by `songid`
  currentSong$.subscribe(log('currentSong'))

  // unique by `file` in case of duplicate songs in the queue
  currentSongUnique$.subscribe(log('currentSongUnique'))

  playlists$.subscribe(log('playlists'))
  message$.subscribe(log('message'))
  dbUpdate$.subscribe(log('dbUpdate'))
  stats$.subscribe(log('stats'))
  partition$.subscribe(log('partition'))
  sticker$.subscribe(log('sticker'))
  subscription$.subscribe(log('subscription'))
  neighbor$.subscribe(log('neighbor'))
  mount$.subscribe(log('mount'))
  output$.subscribe(log('output'))

  setTimeout(async () => {
    console.log('disconnecting...')
    await client.disconnect()
  }, 30000)

  ```
