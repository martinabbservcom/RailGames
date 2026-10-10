# Sibsey Station

A friendly 2D shunting game for all ages. Trains arrive at a small fictional yard, and you sort their wagons and coaches into new trains that match the departures board. Park each finished train at its platform before the clock reaches its leaving time, wait for the passengers to board, and off it goes!

## Play

Open `index.html` in a modern browser. There is nothing to install or build.

1. **Trains arrive** at the Reception road. Their engines run off to the Engine shed on their own.
2. **Click a vehicle** to pick it up. Pip, the little shunting engine, takes it and everything between it and the yard entrance (the left end of the track).
3. **Click a green track** to put the vehicles down there. Pip stays hooked on to them, so you can pick up the same train again straight away. Click Pip to send it back to the signal box.
4. **Check the Departures board.** Build each train like the picture, with the engine at the front (the right-hand end) and the vehicles in the right order.
5. **Park it at its platform** (or the goods road for freight). Once it matches, passengers board (or the wagons are checked) and the train leaves at its booked time.

Stars are awarded for each departure: three for leaving on time, fewer for being late. A train that is not ready six minutes after its time is missed.

Tips: to turn a train round, move vehicles one at a time onto another track. Use the 2×, 4× and 8× buttons to speed things up, the pause button (or the space bar) to stop and think, and Escape to put a picked-up vehicle back.

## Days

1. **Sunny Morning**: two small passenger trains.
2. **Market Day**: passenger and freight trains, with a second platform and the goods road.
3. **Festival Weekend**: six trains, a busy yard, and cars already waiting in the sidings.

Your best stars are saved in the browser.

## Files

- `levels.js` – vehicle types and the three days (arrivals and departures)
- `yard.js` – the game rules and simulation (no drawing code)
- `render.js` – all the 2D drawing: scenery, vehicles, people and effects
- `sound.js` – small synthesised sound effects (no audio files)
- `main.js` – menus, the departures board, mouse and touch input, and the game loop
- `index.html`, `styles.css` – page layout and styling

The game uses no libraries. The Fredoka font is loaded from Google Fonts if online and falls back to a system font offline.

## Notes

- The yard, station and timetable are entirely fictional.
- The signalling game that used to be in the parent folder (Kent Signaller) is separate and untouched.
