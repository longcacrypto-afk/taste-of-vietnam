// Pure mutation of the latest, user-scoped snapshot. Repositories supply atomicity.
// Never accept replacement dish_ids from a client: add/remove are individual commands.
export function applyCollectionOperation(collections, op) {
  const list = structuredClone(collections);
  let col = list.find(c => c.id === op.id);
  if (op.type === 'create') {
    if (col) return null;
    col = { id: op.id, name: op.name, dish_ids: [] };
    list.push(col);
  } else if (op.type === 'save_default') {
    col = list[0];
    if (!col) {
      col = { id: 'col-1', name: 'Món yêu thích', dish_ids: [] };
      list.push(col);
    }
    if (!col.dish_ids.includes(op.dishId)) col.dish_ids.push(op.dishId);
  } else if (op.type === 'remove_everywhere') {
    for (const c of list) c.dish_ids = c.dish_ids.filter(id => id !== op.dishId);
  } else {
    if (!col) return null;
    if (op.type === 'rename') col.name = op.name;
    if (op.type === 'delete') list.splice(list.indexOf(col), 1);
    if (op.type === 'add' && !col.dish_ids.includes(op.dishId)) col.dish_ids.push(op.dishId);
    if (op.type === 'remove') col.dish_ids = col.dish_ids.filter(id => id !== op.dishId);
  }
  return { collections: list, collection: col };
}
