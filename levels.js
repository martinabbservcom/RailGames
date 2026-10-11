(() => {
  'use strict';

  const Y = (window.Yard = window.Yard || {});

  // kind: 'loco' | 'coach' | 'wagon'
  Y.TYPES = {
    steam: { name: 'Steam engine', kind: 'loco', color: '#2f9e6b', trim: '#ffd23f' },
    diesel: { name: 'Diesel engine', kind: 'loco', color: '#e8573d', trim: '#ffe08a' },
    coach: { name: 'Blue coach', kind: 'coach', color: '#3d8bf2' },
    first: { name: 'Gold coach', kind: 'coach', color: '#f4b823' },
    buffet: { name: 'Café car', kind: 'coach', color: '#e5484d' },
    guard: { name: "Guard's van", kind: 'coach', color: '#3fb58a' },
    coal: { name: 'Coal wagon', kind: 'wagon', color: '#6b5b53' },
    tank: { name: 'Tanker', kind: 'wagon', color: '#7ac74f' },
    box: { name: 'Box van', kind: 'wagon', color: '#c9803a' },
    logs: { name: 'Log wagon', kind: 'wagon', color: '#8d99ae' },
    brake: { name: 'Brake van', kind: 'wagon', color: '#d94f4f' }
  };

  // Upgrades bought with the stars earned on the numbered days (see the Upgrades screen).
  Y.UPGRADES = [
    { id: 'pip', icon: '\u26A1', name: 'Turbo Pip', cost: 4, text: 'Pip shunts about 50% faster.' },
    { id: 'service', icon: '\U0001F527', name: 'Quick service', cost: 6, text: 'Engines need 3 minutes in the shed instead of 5.' },
    { id: 'unload', icon: '\U0001F6AA', name: 'Wide doors', cost: 6, text: 'Passengers and goods unload in about half the time.' },
    { id: 'grace', icon: '\U0001F60A', name: 'Patient passengers', cost: 8, text: 'Trains wait 9 minutes before they are cancelled, not 6.' },
    { id: 'crew', icon: '\U0001F3D7\uFE0F', name: 'Rapid recovery', cost: 8, text: 'The recovery crane works nearly twice as fast.' },
    { id: 'safe', icon: '\U0001F6E0\uFE0F', name: 'Track maintenance', cost: 10, text: 'Derailments and engine breakdowns are half as likely.' }
  ];

  // A departure's `spec` lists the train from the FRONT to the back, so it starts
  // with 'loco' (any engine). Track lists in the game run from the yard entrance
  // (left) to the far end (right), so the front of a train is the last vehicle.
  //
  // `arrivals[].track` is the road the train comes in on: a platform ('P1'/'P2') or the goods road 'G'.
  // Trains always arrive from the main line on the right, never from the engine shed side.
  // Trains carrying passengers always use a platform; goods trains use the goods road. `cars` are listed from the yard entrance end once the train has been pulled in;
  // the engine leads, so it ends up at the far end. The road must be empty or the train waits
  // at the signal. Times are minutes after the level starts.
  Y.LEVELS = [
    {
      id: 1,
      tutorial: true,
      sky: { hour: 7, rate: 1.2 },
      weather: 'clear',
      title: 'Sunny Morning',
      blurb: 'Your first day at Sibsey Station. Two little trains to build.',
      start: 8 * 60,
      tracks: ['P1', 'S1', 'S2', 'SHED', 'SHED2'],
      shed: ['steam'],
      initial: {},
      arrivals: [
        { at: 0, from: 'Hillbury', track: 'P1', loco: 'diesel', cars: ['guard', 'coach', 'first', 'coach'] },
        { at: 9, from: 'Marshford', track: 'P1', loco: 'diesel', cars: ['coach', 'guard', 'coach'] }
      ],
      departures: [
        { at: 22, track: 'P1', name: 'Seaside Express', dest: 'Skegness', spec: ['loco', 'coach', 'coach', 'coach', 'guard'] },
        { at: 42, track: 'P1', name: 'Golden Tour', dest: 'Castle Hill', spec: ['loco', 'first', 'coach', 'guard'] }
      ]
    },
    {
      id: 2,
      sky: { hour: 11, rate: 1.6 },
      weather: 'cloudy',
      title: 'Market Day',
      blurb: 'Passengers and freight today. Use the goods road for the wagons.',
      start: 8 * 60,
      tracks: ['P1', 'P2', 'G', 'S1', 'S2', 'S3', 'SHED', 'SHED2'],
      shed: ['diesel', 'steam'],
      initial: {},
      arrivals: [
        { at: 0, from: 'Hillbury', track: 'P2', loco: 'diesel', cars: ['coal', 'coach', 'brake', 'guard', 'coach'] },
        { at: 7, from: 'Marshford', track: 'P1', loco: 'steam', cars: ['box', 'tank', 'coach', 'buffet', 'coal'] },
        { at: 16, from: 'Dockside', track: 'P2', loco: 'diesel', cars: ['first', 'logs', 'box', 'guard', 'brake'] }
      ],
      departures: [
        { at: 20, track: 'P1', name: 'Market Local', dest: 'Greenfield', spec: ['loco', 'coach', 'coach', 'guard'] },
        { at: 32, track: 'G', name: 'Coal to Cityville', dest: 'Cityville', spec: ['loco', 'coal', 'coal', 'tank', 'brake'] },
        { at: 46, track: 'P2', name: 'Café Flyer', special: 'vip', dest: 'Lakeside', spec: ['loco', 'coach', 'buffet', 'first', 'guard'] },
        { at: 62, track: 'G', name: 'Farm Goods', dest: 'Dockside', spec: ['loco', 'box', 'box', 'logs', 'brake'] }
      ]
    },
    {
      id: 3,
      sky: { hour: 15.5, rate: 2.6 },
      weather: 'clear',
      title: 'Festival Weekend',
      blurb: 'The busiest day of the year. Plan ahead and keep the yard moving!',
      start: 8 * 60,
      tracks: ['P1', 'P2', 'G', 'S1', 'S2', 'S3', 'SHED', 'SHED2'],
      shed: ['steam', 'diesel'],
      initial: {
        S1: ['coach', 'guard', 'first'],
        S2: ['logs', 'box', 'coach']
      },
      arrivals: [
        { at: 0, from: 'Hillbury', track: 'P2', loco: 'diesel', cars: ['buffet', 'coach', 'guard', 'coach'] },
        { at: 5, from: 'Dockside', track: 'P1', loco: 'steam', cars: ['brake', 'logs', 'first', 'coach', 'coach'] },
        { at: 12, from: 'Marshford', track: 'P2', loco: 'diesel', cars: ['guard', 'buffet', 'box', 'coach'] },
        { at: 22, from: 'Castle Hill', track: 'P1', loco: 'steam', cars: ['first', 'logs', 'coach', 'brake', 'guard', 'buffet'] }
      ],
      departures: [
        { at: 16, track: 'P1', name: 'Early Commuter', special: 'heritage', dest: 'Cityville', spec: ['steam', 'coach', 'coach', 'coach', 'guard'] },
        { at: 28, track: 'G', name: 'Milk and Mail', special: 'mail', dest: 'Greenfield', spec: ['loco', 'box', 'box', 'brake'] },
        { at: 42, track: 'P2', name: 'Festival Special', special: 'vip', dest: 'Lakeside', spec: ['loco', 'first', 'buffet', 'coach', 'coach', 'coach', 'guard'] },
        { at: 58, track: 'G', name: 'Timber Express', dest: 'Dockside', spec: ['loco', 'logs', 'logs', 'logs', 'brake'] },
        { at: 72, track: 'P1', name: 'Café Cruiser', dest: 'Skegness', spec: ['loco', 'buffet', 'coach', 'coach', 'guard'] },
        { at: 88, track: 'P2', name: 'Golden Jubilee', special: 'vip', dest: 'Castle Hill', spec: ['loco', 'first', 'first', 'buffet', 'guard'] }
      ]
    },
    {
      id: 4,
      sky: { hour: 16.5, rate: 2.2 },
      weather: 'rain',
      title: 'Rush Hour',
      blurb: 'Rain on the rails! Clear the platforms quickly, but keep your own trains off them until they are due!',
      start: 8 * 60,
      tracks: ['P1', 'P2', 'G', 'S1', 'S2', 'S3', 'SHED', 'SHED2'],
      shed: ['diesel', 'steam'],
      initial: {
        S2: ['coal', 'brake']
      },
      arrivals: [
        { at: 0, from: 'Hillbury', track: 'P1', loco: 'diesel', cars: ['coach', 'guard', 'coach', 'coach'] },
        { at: 4, from: 'Marshford', track: 'P2', loco: 'steam', cars: ['first', 'buffet', 'coach', 'guard'] },
        { at: 10, from: 'Dockside', track: 'G', loco: 'diesel', cars: ['box', 'box', 'logs', 'brake'] },
        { at: 20, from: 'Lakeside', track: 'P2', loco: 'steam', cars: ['coach', 'coach', 'guard', 'first'] },
        { at: 30, from: 'Castle Hill', track: 'P1', loco: 'diesel', cars: ['coach', 'buffet', 'coach', 'guard'] }
      ],
      departures: [
        { at: 18, track: 'P1', name: 'Morning Express', special: 'heritage', dest: 'Cityville', spec: ['steam', 'coach', 'coach', 'guard'] },
        { at: 34, track: 'G', name: 'Brick Train', special: 'mail', dest: 'Dockside', spec: ['loco', 'box', 'box', 'brake'] },
        { at: 46, track: 'P2', name: 'Lake Flyer', special: 'vip', dest: 'Lakeside', spec: ['loco', 'first', 'buffet', 'coach', 'guard'] },
        { at: 62, track: 'P1', name: 'Evening Local', dest: 'Greenfield', spec: ['loco', 'coach', 'coach', 'guard'] }
      ]
    },
    {
      id: 5,
      title: 'Endless Rush',
      blurb: 'Trains keep coming and it only gets busier, with track works and derailments. How long can you last? The day ends when you miss 3 trains.',
      endless: true,
      events: true,
      pullLimit: 6,
      sky: { hour: 6.5, rate: 6 },
      start: 8 * 60,
      tracks: ['P1', 'P2', 'G', 'S1', 'S2', 'S3', 'SHED', 'SHED2'],
      shed: ['diesel', 'steam'],
      initial: {},
      arrivals: [],
      departures: []
    },
    {
      id: 6,
      title: 'Free Play',
      blurb: "No timetable. A train arrives every 10 minutes if a road is free. Build your own trains: a train with an engine in front and a guard's or brake van at the back leaves after 2 minutes.",
      freeplay: true,
      events: true,
      pullLimit: 6,
      sky: { hour: 7, rate: 6 },
      start: 8 * 60,
      tracks: ['P1', 'P2', 'G', 'S1', 'S2', 'S3', 'SHED', 'SHED2'],
      shed: ['steam', 'diesel'],
      initial: {
        S1: ['coach', 'coach', 'guard'],
        S2: ['box', 'coal', 'brake']
      },
      arrivals: [],
      departures: []
    }
  ];
})();
