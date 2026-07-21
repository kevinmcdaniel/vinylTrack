Abstract formation picture — boys (squares) and girls (circles) with facing arrows and amber hand-links.

```jsx
<FormationDiagram rows={[
  [{shape:'boy',dir:'up',link:true},{shape:'girl',dir:'down',link:true},{shape:'boy',dir:'up'}],
  [{shape:'girl',dir:'down',link:true},{shape:'boy',dir:'up'}],
]} />
```

Markers and arrows inherit `--facing` (blue light / green dark); links use `--hand-link`. Drop inside a sunken well in formation/sight panels.
