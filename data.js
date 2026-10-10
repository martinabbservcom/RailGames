(() => {
  'use strict';

  window.KentSignaller = window.KentSignaller || {};

  // Size of the schematic in SVG units, and its background captions.
  const map = {
    width: 1200,
    height: 740,
    labels: [
      { text: 'SOUTH EASTERN REGION', x: 60, y: 40, anchor: 'start' },
      { text: 'THE NORTH DOWNS', x: 650, y: 365, anchor: 'middle' },
      { text: 'THE WEALD', x: 380, y: 650, anchor: 'middle' },
      { text: 'MEDWAY TOWNS', x: 930, y: 125, anchor: 'middle' },
      { text: 'WEST KENT', x: 330, y: 430, anchor: 'middle' }
    ]
  };

  // Edge stations mark where the game area ends: trains enter and leave the
  // map there and carry on (or come from) the line named by edgeLabel.
  const stations = [
    { id: 'victoria', name: 'Victoria', platforms: 8, x: 60, y: 100, kind: 'major', anchor: 'middle', dx: 0, dy: -16, info: 'London terminus for the routes via Bromley South, Swanley and the Medway towns.' },
    { id: 'charing-cross', name: 'Charing Cross', platforms: 6, x: 60, y: 170, kind: 'major', anchor: 'middle', dx: 0, dy: -16, info: 'London terminus for the Kent via Tonbridge services.' },
    { id: 'waterloo-east', name: 'Waterloo East', x: 150, y: 190, kind: 'minor', anchor: 'end', dx: -10, dy: 20, info: 'Through station on the Charing Cross route.' },
    { id: 'london-bridge', name: 'London Bridge', x: 240, y: 215, kind: 'major', anchor: 'end', dx: -10, dy: 20, info: 'Central junction where the routes out of London meet.' },
    { id: 'orpington', name: 'Orpington', x: 400, y: 330, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Main-line station on the route via Sevenoaks.' },
    { id: 'sevenoaks', name: 'Sevenoaks', x: 470, y: 520, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Kent main-line station between Orpington and Tonbridge.' },
    { id: 'tonbridge', name: 'Tonbridge', x: 545, y: 640, kind: 'major', anchor: 'end', dx: -18, dy: 4, info: 'Important junction; local sidings are shown schematically.', facilities: ['Tonbridge sidings'] },
    { id: 'tonbridge-sidings', name: 'Tonbridge sidings', x: 545, y: 695, kind: 'yard', anchor: 'middle', dx: 0, dy: 22, info: 'Siding location included for the prototype; exact 1980 track layout is not represented.' },
    { id: 'paddock-wood', name: 'Paddock Wood', x: 670, y: 660, kind: 'junction', anchor: 'middle', dx: 0, dy: 22, info: 'Junction where the Medway Valley line leaves the Tonbridge to Ashford route.' },
    { id: 'marden', name: 'Marden', x: 770, y: 650, kind: 'edge', anchor: 'middle', dx: 0, dy: -16, arrow: 0, edgeLabel: 'To Ashford', info: 'Edge of the game area. Trains continue towards Ashford.' },
    { id: 'bromley-south', name: 'Bromley South', x: 310, y: 215, kind: 'minor', anchor: 'start', dx: 10, dy: -14, info: 'Station on the Chatham main line from Victoria.' },
    { id: 'swanley', name: 'Swanley', x: 470, y: 270, kind: 'junction', anchor: 'middle', dx: 0, dy: -24, info: 'Junction for the Chatham main line and the Maidstone East route.' },
    { id: 'farningham-road', name: 'Farningham Road', x: 530, y: 262, kind: 'minor', anchor: 'start', dx: 10, dy: 20, info: 'Station on the Chatham main line.' },
    { id: 'longfield', name: 'Longfield', x: 590, y: 252, kind: 'minor', anchor: 'middle', dx: 0, dy: -24, info: 'Station on the Chatham main line.' },
    { id: 'meopham', name: 'Meopham', x: 650, y: 242, kind: 'minor', anchor: 'middle', dx: 0, dy: -24, info: 'Station on the Chatham main line.' },
    { id: 'sole-street', name: 'Sole Street', x: 715, y: 230, kind: 'minor', anchor: 'middle', dx: 0, dy: 30, info: 'Station on the Chatham main line.' },
    { id: 'strood', name: 'Strood', x: 780, y: 205, kind: 'junction', anchor: 'middle', dx: 0, dy: -16, info: 'Junction where the Medway Valley line joins the Chatham main line.' },
    { id: 'rochester', name: 'Rochester', x: 880, y: 185, kind: 'minor', anchor: 'middle', dx: 0, dy: -16, info: 'Medway-town station on the Chatham main line.' },
    { id: 'chatham', name: 'Chatham', x: 990, y: 175, kind: 'edge', anchor: 'middle', dx: 0, dy: -16, arrow: 0, edgeLabel: 'To Gillingham', info: 'Edge of the game area. Trains continue towards Gillingham and the Kent coast.' },
    { id: 'eynsford', name: 'Eynsford', x: 505, y: 322, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Station on the Maidstone East line.' },
    { id: 'shoreham', name: 'Shoreham', x: 480, y: 385, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Station on the Maidstone East line.' },
    { id: 'otford', name: 'Otford', x: 505, y: 432, kind: 'junction', anchor: 'end', dx: -10, dy: 4, info: 'Junction between the Maidstone East line and the Swanley to Sevenoaks line.' },
    { id: 'kemsing', name: 'Kemsing', x: 550, y: 452, kind: 'minor', anchor: 'middle', dx: 0, dy: 30, info: 'Station on the Maidstone East line.' },
    { id: 'borough-green', name: 'Borough Green & Wrotham', x: 625, y: 462, kind: 'minor', anchor: 'middle', dx: 0, dy: -24, info: 'Station on the Maidstone East line.' },
    { id: 'west-malling', name: 'West Malling', x: 690, y: 472, kind: 'minor', anchor: 'middle', dx: 0, dy: 30, info: 'Station on the Maidstone East line.' },
    { id: 'east-malling', name: 'East Malling', x: 745, y: 478, kind: 'minor', anchor: 'middle', dx: 0, dy: -24, info: 'Station on the Maidstone East line.' },
    { id: 'barming', name: 'Barming', x: 800, y: 500, kind: 'minor', anchor: 'middle', dx: 0, dy: 22, info: 'Station on the Maidstone East line.' },
    { id: 'maidstone-east', name: 'Maidstone East', x: 1000, y: 530, kind: 'major', anchor: 'middle', dx: 0, dy: 30, info: 'Town station on the line towards Ashford via Bearsted.' },
    { id: 'bearsted', name: 'Bearsted', x: 1065, y: 535, kind: 'edge', anchor: 'middle', dx: 0, dy: -24, arrow: 0, edgeLabel: 'To Ashford', info: 'Edge of the game area. Trains continue towards Hollingbourne and Ashford.' },
    { id: 'beltring', name: 'Beltring', x: 692, y: 624, kind: 'minor', anchor: 'end', dx: -10, dy: -14, info: 'Station on the Medway Valley line.' },
    { id: 'yalding', name: 'Yalding', x: 718, y: 592, kind: 'minor', anchor: 'end', dx: -10, dy: -14, info: 'Station on the Medway Valley line.' },
    { id: 'wateringbury', name: 'Wateringbury', x: 760, y: 562, kind: 'minor', anchor: 'middle', dx: 0, dy: -16, info: 'Station on the Medway Valley line.' },
    { id: 'east-farleigh', name: 'East Farleigh', x: 803, y: 592, kind: 'minor', anchor: 'middle', dx: 0, dy: 22, info: 'Station on the Medway Valley line.' },
    { id: 'maidstone-west', name: 'Maidstone West', x: 850, y: 580, kind: 'major', anchor: 'start', dx: 10, dy: 4, info: 'Town station on the Medway Valley line.' },
    { id: 'maidstone-barracks', name: 'Maidstone Barracks', x: 880, y: 440, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Station on the Medway Valley line, north of Maidstone West.' },
    { id: 'aylesford', name: 'Aylesford', x: 886, y: 396, kind: 'minor', anchor: 'start', dx: 10, dy: 4, info: 'Station on the Medway Valley line.' },
    { id: 'new-hythe', name: 'New Hythe', x: 864, y: 361, kind: 'minor', anchor: 'start', dx: 10, dy: -14, info: 'Station on the Medway Valley line.' },
    { id: 'snodland', name: 'Snodland', x: 840, y: 328, kind: 'minor', anchor: 'start', dx: 10, dy: -14, info: 'Station on the Medway Valley line.' },
    { id: 'halling', name: 'Halling', x: 815, y: 290, kind: 'minor', anchor: 'end', dx: -10, dy: 4, info: 'Station on the Medway Valley line.' },
    { id: 'cuxton', name: 'Cuxton', x: 795, y: 250, kind: 'minor', anchor: 'start', dx: 10, dy: -14, info: 'Station on the Medway Valley line.' }
  ];

  // [from, to, approximate route miles]. The map is schematic, so these are
  // rough real-world distances used for running times, not drawn lengths.
  const edgeDefinitions = [
    ['charing-cross', 'waterloo-east', 0.3],
    ['waterloo-east', 'london-bridge', 1],
    ['london-bridge', 'orpington', 11.5],
    ['orpington', 'sevenoaks', 10],
    ['sevenoaks', 'tonbridge', 6],
    ['tonbridge', 'paddock-wood', 6],
    ['paddock-wood', 'marden', 3.5],
    ['tonbridge', 'tonbridge-sidings', 0.5],
    ['victoria', 'bromley-south', 9.5],
    ['bromley-south', 'swanley', 6.5],
    ['swanley', 'farningham-road', 2],
    ['farningham-road', 'longfield', 2.5],
    ['longfield', 'meopham', 2],
    ['meopham', 'sole-street', 2.5],
    ['sole-street', 'strood', 4.5],
    ['strood', 'rochester', 1.2],
    ['rochester', 'chatham', 1.5],
    ['swanley', 'eynsford', 2.5],
    ['eynsford', 'shoreham', 2],
    ['shoreham', 'otford', 1.5],
    ['otford', 'kemsing', 1.5],
    ['kemsing', 'borough-green', 2.5],
    ['borough-green', 'west-malling', 3],
    ['west-malling', 'east-malling', 1.5],
    ['east-malling', 'barming', 2],
    ['barming', 'maidstone-east', 2.5],
    ['maidstone-east', 'bearsted', 2.2],
    ['otford', 'sevenoaks', 3.5],
    ['paddock-wood', 'beltring', 1.5],
    ['beltring', 'yalding', 2],
    ['yalding', 'wateringbury', 3],
    ['wateringbury', 'east-farleigh', 2],
    ['east-farleigh', 'maidstone-west', 2],
    ['maidstone-west', 'maidstone-barracks', 0.5],
    ['maidstone-barracks', 'aylesford', 3.5],
    ['aylesford', 'new-hythe', 1.5],
    ['new-hythe', 'snodland', 1.5],
    ['snodland', 'halling', 2],
    ['halling', 'cuxton', 2],
    ['cuxton', 'strood', 2.5]
  ];

  // Average running speeds in mph between stops. Yard and siding blocks are
  // taken at shunting speed.
  const speeds = { EMU: 60, DMU: 45, FREIGHT: 40, yard: 10 };

  // Minutes spent standing at a station: at an intermediate stop, and at the
  // end of the journey before the train is taken out of the section. Trains
  // leaving the map at an edge station do not stand.
  const dwell = {
    stop: { EMU: 1, DMU: 1, FREIGHT: 0 },
    terminate: { EMU: 3, DMU: 3, FREIGHT: 3 }
  };

  // Platforms (or sidings) per station, unless the station sets its own.
  // A train must have a free one before it is allowed into the station.
  const defaultPlatforms = { major: 3, minor: 2, junction: 2, yard: 3, edge: 4 };

  // Sample timetable. Where the shortest route is not the booked one, `via`
  // lists the stations the service must pass through on the way.
  const timetable = [
    { at: 0, origin: 'victoria', destination: 'chatham', number: '7421', type: 'EMU', stock: 'Class 411 4-CEP', unit: '7142' },
    { at: 4, origin: 'charing-cross', destination: 'tonbridge', number: '6814', type: 'EMU', stock: 'Class 423 4-VEP', unit: '7745' },
    { at: 8, origin: 'victoria', destination: 'maidstone-east', number: '7433', type: 'EMU', stock: 'Class 421 4-CIG', unit: '7389' },
    { at: 12, origin: 'paddock-wood', destination: 'strood', via: ['maidstone-west'], number: '2B14', type: 'DMU', stock: 'Class 117 DMU', unit: 'L 421' },
    { at: 14, origin: 'charing-cross', destination: 'marden', number: '6826', type: 'EMU', stock: 'Class 411 4-CEP', unit: '7117' },
    { at: 21, origin: 'chatham', destination: 'victoria', number: '7446', type: 'EMU', stock: 'Class 423 4-VEP', unit: '7812' },
    { at: 29, origin: 'tonbridge-sidings', destination: 'chatham', number: '6M12', type: 'FREIGHT', stock: 'Class 33', unit: '33 025' },
    { at: 34, origin: 'bearsted', destination: 'victoria', number: '7452', type: 'EMU', stock: 'Class 421 4-CIG', unit: '7342' },
    { at: 38, origin: 'charing-cross', destination: 'paddock-wood', number: '6838', type: 'EMU', stock: 'Class 411 4-CEP', unit: '7142' },
    { at: 48, origin: 'victoria', destination: 'bearsted', number: '7461', type: 'EMU', stock: 'Class 423 4-VEP', unit: '7745' },
    { at: 56, origin: 'strood', destination: 'paddock-wood', via: ['maidstone-west'], number: '2B18', type: 'DMU', stock: 'Class 117 DMU', unit: 'L 433' },
    { at: 59, origin: 'marden', destination: 'tonbridge-sidings', number: '6K24', type: 'FREIGHT', stock: 'Class 33', unit: '33 112' },
    { at: 72, origin: 'victoria', destination: 'strood', number: '7483', type: 'EMU', stock: 'Class 421 4-CIG', unit: '7389' },
    { at: 84, origin: 'marden', destination: 'charing-cross', number: '6850', type: 'EMU', stock: 'Class 411 4-CEP', unit: '7117' },
    { at: 96, origin: 'chatham', destination: 'tonbridge-sidings', number: '6K31', type: 'FREIGHT', stock: 'Class 73', unit: '73 004' },
    { at: 108, origin: 'victoria', destination: 'maidstone-east', number: '7505', type: 'EMU', stock: 'Class 423 4-VEP', unit: '7812' },
    { at: 121, origin: 'charing-cross', destination: 'tonbridge', number: '6862', type: 'EMU', stock: 'Class 421 4-CIG', unit: '7342' },
    { at: 135, origin: 'maidstone-east', destination: 'victoria', number: '7527', type: 'EMU', stock: 'Class 411 4-CEP', unit: '7142' },
    { at: 150, origin: 'tonbridge-sidings', destination: 'marden', number: '6M44', type: 'FREIGHT', stock: 'Class 33', unit: '33 025' },
    { at: 165, origin: 'charing-cross', destination: 'marden', number: '6874', type: 'EMU', stock: 'Class 423 4-VEP', unit: '7745' },
    { at: 180, origin: 'victoria', destination: 'chatham', number: '7549', type: 'EMU', stock: 'Class 421 4-CIG', unit: '7389' }
  ];

  window.KentSignaller.data = { map, stations, edgeDefinitions, timetable, speeds, dwell, defaultPlatforms };
})();
