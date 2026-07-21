The sequence editor's core row: the SPOKEN call beside its underlying CHOREO.

```jsx
<CallStepRow index="07" name="Swing Thru" difficulty={2}
  formationIn="Ocean Waves" formationOut="Ocean Waves"
  hands="right, then left" beats={6} tech="Ends turn, centers turn" />
```

Left border + background tint signal `resolution` (resolved = none, ambiguous = amber, unresolved = red). Composes DesignatorPill, DifficultyPips and WarningChip. Works in both themes; put several in a `<div>` with column heads to form the step list.
