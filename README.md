# Kent Signaller

**A railway signalling game set on the railways of Kent, inspired by the British Rail era around 1980.**

Kent Signaller is a prototype about keeping trains moving safely across a busy network. The player takes the role of a signaller, watching trains approach, setting signals, and managing occupied track blocks across a schematic map of Kent and the approaches from London.

## The concept

The game aims to bring the work of railway signalling to life: trains follow routes through junctions and stations, and the player decides when it is safe to let them proceed. A clear signal gives a train permission to enter the next block. A train in a block occupies it, so the signal protecting that block cannot be cleared until the train has passed.

The setting is inspired by **1980**, with British Rail Southern Region services and a mix of passenger and freight traffic. The aim is to grow this prototype into a more detailed route-working game, where geography, junctions, sidings, timetables, and the player's decisions all matter.

## The route

The game area covers West Kent. Where the railway carries on beyond it, an edge station with an arrow shows where trains come from and go to; that traffic is managed outside this game. The current schematic brings together:

- London termini and the main line through Orpington and Sevenoaks to Tonbridge, then Paddock Wood and Marden (edge, towards Ashford)
- London Victoria through Bromley South and Swanley, then Farningham Road, Longfield, Meopham, Sole Street, Strood, and Rochester to Chatham (edge, towards Gillingham)
- The Maidstone East line from Swanley through Eynsford, Shoreham, Otford, Kemsing, Borough Green & Wrotham, West Malling, East Malling, and Barming to Maidstone East and Bearsted (edge, towards Ashford)
- The Medway Valley line from Paddock Wood through Yalding, Wateringbury, East Farleigh, Maidstone West, Maidstone Barracks, Aylesford, Snodland, Halling, and Cuxton to Strood
- The link from Swanley through Otford to Sevenoaks

The Maidstone East line and the Medway Valley line cross at Maidstone. Not every small station is shown (for example Hildenborough, between Sevenoaks and Tonbridge, is left out).

Stations, junctions, and example sidings are selectable on the map. The map is arranged north-up to make the broad geography easier to follow.

## How to play the prototype

1. Open `index.html` in a modern web browser.
2. Watch the simulation clock and the train register as services enter the map.
3. Click a signal to clear every free block on the rest of the route of the train using that block. If no train is routed over it, only that block is cleared. Click it again to return the route to danger. Each block's signal returns to danger by itself once a train has entered it.
4. Hover over a train for its headcode, stock, unit number, route, next stop and status. Select a train or station to see more in the notes panel.
5. Use the pause and speed controls to manage the simulation.
6. Scroll over the map to zoom, and drag to pan.

Running times come from approximate real-world distances between stations and average speeds (60 mph for EMUs, 40 mph for freight, 10 mph in yards), not from the lengths drawn on the schematic. At 1× the clock runs ten times faster than real time.

Trains stop at stations. Every station has a limited number of platforms (or sidings), and a train is only allowed into a station while one is free; otherwise it is held at the previous station even with the signal cleared. Passenger trains stand for a minute at each stop and three at the end of their journey. Freight passes through intermediate stations without stopping.

Signals protect individual track blocks. Trains wait at danger signals, and occupied blocks remain protected while a train is inside them.

## Historical accuracy

This is an **1980-inspired prototype**, not a historically verified simulation. The map is schematic and not to scale; it does not show a verified 1980 signalling plan or exact track, platform, or siding layouts. Train numbers, service patterns, and timings are sample data created to demonstrate gameplay, not transcribed from an archival working timetable.

Future historical development should verify route geography, railway infrastructure, signalling arrangements, rolling stock, and service timings against reliable period sources before presenting them as accurate.

## Current scope and possible next steps

The current build is a small, self-contained browser prototype made with HTML, CSS, and JavaScript. It has no build step and no JavaScript dependencies. The page optionally loads web fonts from Google Fonts; if they are unavailable (for example offline) it falls back to system fonts.

The signalling model is deliberately simple: each signal protects one track block and a train occupies a block while inside it. It is not a full interlocking.

Possible directions for development include:

- More detailed, historically researched track layouts and signal-box areas
- Timetable adherence, delays, conflicts, and service performance
- More realistic interlocking and route-setting rules
- Additional train types, freight workings, yards, and sidings
- Scenario selection, objectives, and a tutorial
- Improved map zoom, detail, and route-specific controls

## Running locally

Open `index.html` directly in a browser. To work on the prototype, edit the files below, then refresh the page:

- `data.js` – stations, track blocks and the sample timetable
- `sim.js` – the simulation (routing, signals, train movement); it does not touch the DOM
- `game.js` – rendering, input, and the simulation loop
- `styles.css` and `index.html` – layout and styling

The scripts are plain `<script>` files rather than ES modules so the page still works when opened straight from disk.
