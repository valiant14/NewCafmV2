const clean = value => String(value ?? '').trim().toUpperCase()
// A store only has to carry a code and a name. Numeric codes are legitimate - a warehouse is
// often numbered after its site - and rejecting them hid real stores from every list.
export const isUsableStore = store => Boolean(String(store?.code || '').trim() && String(store?.name || '').trim())

export const stores = []

export const storeByCode = (code, storeRows = []) => storeRows.filter(isUsableStore).find(store => clean(store.code) === clean(code)) || null

export const storeLocation = (code, storeRows = [], locations = []) => {
  const store = storeByCode(code, storeRows)
  if (!store) return null
  return locations.find(location => location.location === store.location) || null
}

export const storeLabel = (code, storeRows = []) => storeByCode(code, storeRows)?.name || code || ''

// Stock is held per store, so an item can sit in several with different quantities.
export const stockForItem = (itemNumber, rows = []) =>
  rows.filter(row => clean(row.itemNumber) === clean(itemNumber))

export const stockForStore = (storeCode, rows = []) =>
  rows.filter(row => clean(row.storeroom) === clean(storeCode))

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

export const totalBalance = (itemNumber, rows = []) => sum(stockForItem(itemNumber, rows), 'balance')
export const totalReserved = (itemNumber, rows = []) => sum(stockForItem(itemNumber, rows), 'reserved')

export const totalAvailable = (itemNumber, rows = []) =>
  Math.max(0, totalBalance(itemNumber, rows) - totalReserved(itemNumber, rows))

export const storesHolding = (itemNumber, rows = []) =>
  stockForItem(itemNumber, rows).filter(row => Number(row.balance) > 0).map(row => row.storeroom)

// A material is only "Available" when what is free across all stores clears its reorder level.
export const availabilityFor = (item, rows = []) => {
  const available = totalAvailable(item?.itemNumber, rows)
  const reorderLevel = Number(item?.reorderLevel || 0)
  if (available <= 0) return 'Purchase Required'
  return available <= reorderLevel ? 'Low Stock' : 'Available'
}

// Where an item stands in the supply chain, distinct from whether stock is on the shelf:
// Allocated means it is reserved against a job, On PR/On PO mean it is being procured.
// Display only for now - nothing in the app writes these transitions yet.
export const MATERIAL_STATUSES = ['Available', 'Allocated', 'On PR', 'On PO']

export const materialStatusTone = status => ({
  Available: 'green',
  'Low Stock': 'orange',
  'Purchase Required': 'orange',
  Allocated: 'blue',
  'On PR': 'purple',
  'On PO': 'orange'
}[String(status || '').trim()] || 'neutral')

export const materialStatusFor = (itemNumber, materials = []) =>
  materials.find(item => clean(item.itemNumber) === clean(itemNumber))?.status || ''

export const storeSummary = (materials = [], rows = [], storeRows = [], locations = []) => storeRows.filter(isUsableStore).map(store => {
  const stock = stockForStore(store.code, rows)
  return {
    ...store,
    locationDescription: storeLocation(store.code, storeRows, locations)?.description || '',
    itemCount: stock.length,
    totalQuantity: sum(stock, 'balance'),
    totalReserved: sum(stock, 'reserved'),
    belowReorder: stock.filter(row => {
      const material = materials.find(item => clean(item.itemNumber) === clean(row.itemNumber))
      const reorderLevel = Number((row.reorderLevel ?? material?.reorderLevel) || 0)
      return material && Number(row.balance) - Number(row.reserved) <= reorderLevel
    }).length
  }
})

export const storeStockRows = (storeCode, materials = [], rows = []) =>
  stockForStore(storeCode, rows).map(row => {
    const material = materials.find(item => clean(item.itemNumber) === clean(row.itemNumber)) || {}
    return {
      itemNumber: row.itemNumber,
      description: material.description || '',
      category: material.category || '',
      unit: material.unit || '',
      balance: Number(row.balance) || 0,
      reserved: Number(row.reserved) || 0,
      available: Math.max(0, (Number(row.balance) || 0) - (Number(row.reserved) || 0)),
      reorderLevel: Number((row.reorderLevel ?? material.reorderLevel) || 0)
    }
  })

// An item can be addressed by its code or by its description: a link from a reservation carries
// the code, one from the dashboard snapshot carries only the description.
export const matchesItemId = (id, ...candidates) => {
  const wanted = String(id || '').trim().toLowerCase()
  return Boolean(wanted) && candidates.some(value => String(value || '').trim().toLowerCase() === wanted)
}
