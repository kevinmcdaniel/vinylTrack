Flags a tricky call. Two levels read differently on purpose.

```jsx
<WarningChip level="inherent" text="In — check facing" />
<WarningChip level="contextual" text="Tight transition" />
```

`inherent` (amber) is true for the call everywhere; `contextual` (rose) is true only at this spot in this routine.
