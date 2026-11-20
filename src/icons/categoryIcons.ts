// Line icons for ingredient categories, drawn on the BrewHive Icons canvas
// (Ingredient category icons board). Each body is the inner markup of a 24x24
// stroke SVG. "{id}" is replaced with an id unique to each drawing.

export interface CategoryIconDef {
  id: string;
  /** What the drawing shows, for the icon picker. */
  label: string;
  body: string;
}

export const CATEGORY_ICONS: CategoryIconDef[] = [
  { id: "honey", label: "Honey", body: "<polygon points=\"8.1,4.9 12,7.15 12,11.65 8.1,13.9 4.21,11.65 4.21,7.15\"></polygon><polygon points=\"15.9,4.9 19.79,7.15 19.79,11.65 15.9,13.9 12,11.65 12,7.15\"></polygon><polygon points=\"12,11.65 15.9,13.9 15.9,18.4 12,20.65 8.1,18.4 8.1,13.9\"></polygon>" },
  { id: "fruit", label: "Fruit", body: "<path d=\"M12 7.5c-1.5-1-5-1.3-6.5 1.2C4 11.2 5 16 7 18.6c1.3 1.7 2.7 2.6 5 1.6 2.3 1 3.7.1 5-1.6 2-2.6 3-7.4 1.5-9.9C17 6.2 13.5 6.5 12 7.5z\"></path><path d=\"M12 7.5c0-2 .6-3.6 1.8-4.8\"></path><path d=\"M13.2 5.4c1.6-2.1 4.6-2.9 7.3-1.9-1.3 2.6-4.4 3.6-7.3 1.9z\"></path>" },
  { id: "juice", label: "Juice", body: "<path d=\"M6.5 7h11l-1.3 12.5A1.7 1.7 0 0 1 14.5 21h-5a1.7 1.7 0 0 1-1.7-1.5z\"></path><path d=\"M7.2 12.5h9.6\"></path><path d=\"M12.5 10l2.6-7.5H18\"></path>" },
  { id: "sweetener", label: "Sugar cubes", body: "<polygon points=\"8.19,11.5 12,13.7 12,18.1 8.19,20.3 4.38,18.1 4.38,13.7\"></polygon><path d=\"M4.38 13.7L8.19 15.9L12 13.7M8.19 15.9L8.19 20.3\"></path><polygon points=\"15.81,11.5 19.62,13.7 19.62,18.1 15.81,20.3 12,18.1 12,13.7\"></polygon><path d=\"M12 13.7L15.81 15.9L19.62 13.7M15.81 15.9L15.81 20.3\"></path><polygon points=\"12,4.9 15.81,7.1 15.81,11.5 12,13.7 8.19,11.5 8.19,7.1\"></polygon><path d=\"M8.19 7.1L12 9.3L15.81 7.1M12 9.3L12 13.7\"></path>" },
  { id: "spice", label: "Star anise", body: "<path d=\"M10.71 11.5Q10.66 8.5 12 6.6Q13.34 8.5 13.29 11.5M13.29 11.5Q15.36 9.34 17.66 8.94Q17.26 11.24 15.1 13.31M15.1 13.31Q18.1 13.26 20 14.6Q18.1 15.94 15.1 15.89M15.1 15.89Q17.26 17.96 17.66 20.26Q15.36 19.86 13.29 17.7M13.29 17.7Q13.34 20.7 12 22.6Q10.66 20.7 10.71 17.7M10.71 17.7Q8.64 19.86 6.34 20.26Q6.74 17.96 8.9 15.89M8.9 15.89Q5.9 15.94 4 14.6Q5.9 13.26 8.9 13.31M8.9 13.31Q6.74 11.24 6.34 8.94Q8.64 9.34 10.71 11.5\"></path><circle cx=\"12\" cy=\"14.6\" r=\"1.85\"></circle><path d=\"M8.5 6.2c-.8-1 .8-1.8 0-3M12 5.6c-.8-1 .8-1.8 0-3M15.5 6.2c-.8-1 .8-1.8 0-3\"></path>" },
  { id: "herb", label: "Flower", body: "<circle cx=\"12\" cy=\"4.9\" r=\"2.2\"></circle><circle cx=\"14.95\" cy=\"7.05\" r=\"2.2\"></circle><circle cx=\"13.85\" cy=\"10.5\" r=\"2.2\"></circle><circle cx=\"10.15\" cy=\"10.5\" r=\"2.2\"></circle><circle cx=\"9.05\" cy=\"7.05\" r=\"2.2\"></circle><circle cx=\"12\" cy=\"7.9\" r=\"1\"></circle><path d=\"M12 12.7V21\"></path><path d=\"M12 17.5c-2.8 0-4.4-1.4-5-3.8 2.6 0 4.4 1.3 5 3.8z\"></path>" },
  { id: "yeast", label: "Yeast", body: "<circle cx=\"9.5\" cy=\"9.5\" r=\"5\"></circle><circle cx=\"17\" cy=\"15.5\" r=\"3\"></circle><circle cx=\"9\" cy=\"19\" r=\"2\"></circle><path d=\"M8 8.5a1.8 1.8 0 0 1 2-1.2\"></path>" },
  { id: "nutrient", label: "Nutrients", body: "<rect x=\"6\" y=\"2.5\" width=\"12\" height=\"4\" rx=\"1.2\"></rect><path d=\"M7.5 6.5V19a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V6.5\"></path><path d=\"M9.5 4.5h5\"></path><path d=\"M12 11v6M9 14h6\"></path>" },
  { id: "additive", label: "Test tube", body: "<path d=\"M9 3h6\"></path><path d=\"M10 3v14a2 2 0 0 0 4 0V3\"></path><path d=\"M10 12h4\"></path>" },
  { id: "fining", label: "Funnel and drop", body: "<path d=\"M4 3.5h16l-6 7v3.5h-4v-3.5z\"></path><path d=\"M7.2 7h9.6\"></path><path d=\"M12 16.5c-1.2 1.6-1.9 2.5-1.9 3.4a1.9 1.9 0 0 0 3.8 0c0-.9-.7-1.8-1.9-3.4z\"></path>" },
  { id: "oak", label: "Oak", body: "<circle cx=\"12\" cy=\"12\" r=\"8.5\"></circle><path d=\"M12 6.5a5.5 5.5 0 1 1-5.2 3.7\"></path><circle cx=\"12\" cy=\"12\" r=\"2.2\"></circle><path d=\"M12 3.5v3.5\"></path>" },
  { id: "grain", label: "Wheat", body: "<path d=\"M12 21V6.5\"></path><path d=\"M12 6.5c-1.1-1-1.1-2.6 0-3.8 1.1 1.2 1.1 2.8 0 3.8z\"></path><path d=\"M12 10c-2.4 0-3.6-1.3-3.8-3.3 2.2 0 3.6 1.2 3.8 3.3zM12 10c2.4 0 3.6-1.3 3.8-3.3-2.2 0-3.6 1.2-3.8 3.3z\"></path><path d=\"M12 14c-2.4 0-3.6-1.3-3.8-3.3 2.2 0 3.6 1.2 3.8 3.3zM12 14c2.4 0 3.6-1.3 3.8-3.3-2.2 0-3.6 1.2-3.8 3.3z\"></path><path d=\"M12 18c-2.4 0-3.6-1.3-3.8-3.3 2.2 0 3.6 1.2 3.8 3.3zM12 18c2.4 0 3.6-1.3 3.8-3.3-2.2 0-3.6 1.2-3.8 3.3z\"></path>" },
  { id: "hops", label: "Hops", body: "<defs><clipPath id=\"{id}\"><path d=\"M12 4.5c3.8 2.6 5.9 5.8 5.9 9.1 0 4-2.7 6.7-5.9 8-3.2-1.3-5.9-4-5.9-8 0-3.3 2.1-6.5 5.9-9.1z\"></path></clipPath></defs><path d=\"M-12 2L10 24M-5 2L17 24M2 2L24 24M9 2L31 24M16 2L38 24M8 2L-14 24M15 2L-7 24M22 2L0 24M29 2L7 24M36 2L14 24\" clip-path=\"url(#{id})\"></path><path d=\"M12 4.5c3.8 2.6 5.9 5.8 5.9 9.1 0 4-2.7 6.7-5.9 8-3.2-1.3-5.9-4-5.9-8 0-3.3 2.1-6.5 5.9-9.1z\"></path><path d=\"M12 4.5V2.2\"></path><path d=\"M12 3c1.5-1.4 3.6-1.5 5-.4-1.4 1.4-3.5 1.6-5 .4z\"></path>" },
  { id: "jar", label: "Jar", body: "<rect x=\"7\" y=\"3\" width=\"10\" height=\"3\" rx=\"1\"></rect><path d=\"M6.5 6h11v13a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z\"></path><path d=\"M9 12.5h6M9 15.5h4\"></path>" },
  { id: "water", label: "Water", body: "<path d=\"M12 3c-3 4-6 7.5-6 11.5a6 6 0 0 0 12 0C18 10.5 15 7 12 3z\"></path><path d=\"M9.5 15a2.5 2.5 0 0 0 2 2.4\"></path>" },
  { id: "tannin", label: "Leaf", body: "<path d=\"M5 19C5 10 10 5 19 5c0 9-5 14-14 14z\"></path><path d=\"M5 19l8-8\"></path>" },
  { id: "spice-jar", label: "Spice jar", body: "<rect x=\"8\" y=\"3\" width=\"8\" height=\"4\" rx=\"1\"></rect><path d=\"M8.5 7h7l1 3v10a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10z\"></path><path d=\"M7.5 13h9\"></path><circle cx=\"10.5\" cy=\"5\" r=\"0.4\"></circle><circle cx=\"13.5\" cy=\"5\" r=\"0.4\"></circle>" },
];
