# Sibsey Station

A friendly 2D shunting game for all ages. Trains arrive at a small fictional yard, and you sort their wagons and coaches into new trains that match the departures board. Park each finished train at its platform before the clock reaches its leaving time, wait for the passengers to board, and off it goes!

## Play

Open `index.html` in a modern browser. There is nothing to install or build.

1. **Trains arrive** from the main line on the right, at a platform (or the goods road), with the engine at the front. Take the whole train into a siding and the tired engine goes to the engine shed by itself to be serviced.
2. **Click a vehicle** to pick it up. Pip, the little shunting engine, takes it and everything between it and the yard entrance (the left end of the track). Click an engine to send just the engine.
3. **Click a green track** to put the vehicles down there. Pip stays hooked on to them, so you can pick up the same train again straight away. Click Pip to send it back to its own siding.
4. **Check the timetable.** Build each train like the picture, with the engine at the front (the right-hand end) and the vehicles in the right order, with the guard's or brake van at the back.
5. **Park it at its platform** (or the goods road for freight). Once it matches, passengers board (or the wagons are checked) and the train leaves at its booked time.

Stars are awarded for each departure: three for leaving on time, fewer for being late. A train that is not ready six minutes after its time is missed.

Tips: to turn a train round, move vehicles one at a time onto another track. Use the 2×, 4× and 8× buttons to speed things up, the pause button (or the space bar) to stop and think, and Escape to put a picked-up vehicle back.

## Days

1. **Sunny Morning**: two small passenger trains, with a short guided tutorial the first time you play.
2. **Market Day**: passenger and freight trains, with a second platform and the goods road.
3. **Festival Weekend**: a busy yard with VIP, mail and heritage steam trains that earn bonus stars.
4. **Rush Hour**: rain, and the turntable: engines have a direction and must be turned before they pull a train.
5. **Endless Rush**: a timetable that keeps getting busier, with random events (track works, derailments with a recovery crane, signal failures and engine breakdowns), changing weather and a full day and night. One engine can only pull six wagons or coaches, so longer trains need two.
6. **Free Play**: no timetable. A train arrives every ten minutes (or call one in early), and any train with a serviced engine in front and a van at the back leaves from a platform after two minutes.

Stars from days 1 to 4 can be spent on **Upgrades** from the menu. Your best results and upgrades are saved in the browser. The **Stats** button shows how the day is going.

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
