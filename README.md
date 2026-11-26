# Marv's Workshop

Colour matching for Magicman technicians. It combines two earlier projects, MARV's Colour Lab (the game) and MARV's Mix Bench (the small-mix tools), into one app.

## What it will do

- **Match from a photo.** Take or choose a real photo of a surface, read the colour from it, and mix to match it with the tints and bases carried on the van. This is the headline feature. Accuracy is to be tuned later; the first job is to prove it works.
- **Practise on 3D scenes.** Fourteen repair scenes, each with two or three damage spots and a target colour generated at random, so rounds never run out. Four levels from Colour Lab set the pass mark: Trainee, Technician, Senior Technician and Master Technician. Trainees mix with primary colours; technicians use the van tints.
- **Leaderboards.** Scores by level.
- **Small-mix tools.** Scaling a recipe, fixing a mix that is off, and collecting recipes. Carried over from Mix Bench.

## Status

Early. Photo matching and the 3D scenes each work on their own page. The mixing, the levels and scoring, leaderboards and the small-mix tools are not built yet, and the pages are not yet joined into one app.

| Path | What it is |
|---|---|
| `photo.html` | Match from a photo: slide a reference card into the picture, tap the surface, read its corrected colour |
| `js/colour.js` | Colour maths: CIELAB, the ΔE2000 difference, and the camera correction fitted from the reference card |
| `js/refcard.js` | The reference card: its patches and how it is read from a photo. Provisional until a printed card is measured |
| `tests/colour-test.js` | Checks the maths against published reference pairs and the feasibility report's 68 photo readings. Run with `node tests/colour-test.js` |
| `examples.html` | Try the scenes: turn, pinch to zoom, move the damage, random jobs, pass mark by level |
| `js/scenes.js` | The scene kit: fourteen 3D scenes, damage spots, the viewer |
| `vendor/` | three.js r147 and the two add-ons the scene kit needs |
| `brand/` | Magicman logo (from the brand guide) and the MARV poses |

Open `examples.html` in a browser to run it. There is no build step.

## Design rules

- **Brand:** Wasabi `#aed284`, Crow Black Blue `#13294b`, Lone Hunter `#93c847`, from the Magicman brand guide. The logo is not to be rotated, skewed, recoloured or placed on a similar colour.
- **Font:** Verdana throughout, at the owner's request. The brand guide lists Helvetica Bold and Open Sans. Verdana is not installed on Android, where a fallback shows.
- **Look:** cream paper, navy ink, raised cards, pill buttons with a Magicman green edge and a soft gloss.
- **Wording:** it is not called a training app.

## What is approximate

- **The reference card is virtual for now.** On the built-in sample photos it corrects the colour properly, because the app lays the card in the scene before applying a simulated camera shift. On a real photo a virtual card cannot correct anything, since it has not been through the camera, and the page says so. A printed card in the shot is supported, but no printed card exists yet and its patch values would need measuring.
- Sample photos are simulated. In the feasibility tests real photos came out between 4 and 10 on the ΔE2000 scale, against the 1 to 2 a repair needs.
- Target colours are generated in code and are not exact RAL values.
- The 3D scenes are simple models built for this app, not photographs.
- In `examples.html` a slider stands in for the player's mixing. The real mixing model is still to be built, and no measured data exists for how the van tints behave when mixed.
- Pass marks are derived from Colour Lab's tolerances and are open to tuning.
