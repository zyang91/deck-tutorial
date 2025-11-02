// Constants
const DATA_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/arc/counties.json';
const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const inFlowColors = [
  [255, 255, 204],
  [199, 233, 180],
  [127, 205, 187],
  [65, 182, 196],
  [29, 145, 192],
  [34, 94, 168],
  [12, 44, 132]
];

const outFlowColors = [
  [255, 255, 178],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [177, 0, 38]
];

// Map init
const map = new maplibregl.Map({
  container: 'map',
  style: MAP_STYLE,
  center: [-100, 40.7],
  zoom: 3,
  pitch: 30,
  bearing: 30,
  attributionControl: true
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

// deck.gl overlay atop MapLibre
const overlay = new deck.MapboxOverlay({
  interleaved: true,
  getTooltip: ({ object }) => object && object.properties && object.properties.name
});
map.addControl(overlay);

// Helpers
function calculateArcs(data, selectedCounty) {
  if (!data || !data.length) return null;

  if (!selectedCounty) {
    selectedCounty = data.find(
      f => f.properties && f.properties.name === 'Philadelphia, PA'
    );
  }
  if (!selectedCounty) return null;

  const flows = selectedCounty.properties.flows || {};
  const arcs = Object.keys(flows).map(toId => {
    const target = data[Number(toId)];
    return {
      source: selectedCounty,
      target,
      value: flows[toId],
      quantile: 0
    };
  });

  const scale = d3.scaleQuantile()
    .domain(arcs.map(a => Math.abs(a.value)))
    .range(inFlowColors.map((_, i) => i));

  arcs.forEach(a => { a.quantile = scale(Math.abs(a.value)); });
  return arcs;
}

function buildLayers(geojson, selectedCounty, strokeWidth = 1) {
  const arcs = calculateArcs(geojson, selectedCounty);

  const geoLayer = new deck.GeoJsonLayer({
    id: 'counties-fill',
    data: geojson,
    stroked: false,
    filled: true,
    getFillColor: [0, 0, 0, 0],
    pickable: true,
    onClick: ({ object }) => {
      if (!object) return;
      const layers = buildLayers(geojson, object);
      overlay.setProps({ layers });
    }
  });

  const arcLayer = new deck.ArcLayer({
    id: 'migration-arcs',
    data: arcs,
    getSourcePosition: d => d.source.properties.centroid,
    getTargetPosition: d => d.target.properties.centroid,
    getSourceColor: d =>
      (d.value > 0 ? inFlowColors : outFlowColors)[d.quantile],
    getTargetColor: d =>
      (d.value > 0 ? outFlowColors : inFlowColors)[d.quantile],
    getWidth: strokeWidth
  });

  return [geoLayer, arcLayer];
}

function renderLegendBar() {
  const bar = document.getElementById('legend-bar');
  if (!bar) return;

  // Start with darker blues on the left (net gain), then through yellows to reds (net loss)
  const colors = [
    ...inFlowColors.slice().reverse(),  // blue (dark → light)
    ...outFlowColors                    // yellow → orange → red
  ];

  // Clear and rebuild
  bar.innerHTML = '';
  colors.forEach(rgb => {
    const seg = document.createElement('span');
    seg.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    bar.appendChild(seg);
  });
}
renderLegendBar();

// Load data & render
fetch(DATA_URL)
  .then(r => r.json())
  .then(({ features }) => {
    const layers = buildLayers(features, null, 1);
    overlay.setProps({ layers });
  })
  .catch(err => console.error('Failed to load data:', err));
