import storerooms from '../data/storerooms.json'
import inventorySeed from '../data/inventory.json'
import locations from '../data/locations.json'

const clean = value => String(value ?? '').trim().toUpperCase()

export const stores = storerooms

export const storeByCode = code => storerooms.find(store => clean(store.code) === clean(code)) || null

export const storeLocation = code => {
  const store = storeByCode(code)
  if (!store) return null
  return locations.find(location => location.location === store.location) || null
}

export const storeLabel = code => storeByCode(code)?.name || code || ''

// Stock is held per store, so an item can sit in several with different quantities.
export const stockForItem = (itemNumber, rows = inventorySeed) =>
  rows.filter(row => clean(row.itemNumber) === clean(itemNumber))

export const stockForStore = (storeCode, rows = inventorySeed) =>
  rows.filter(row => clean(row.storeroom) === clean(storeCode))

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

export const totalBalance = (itemNumber, rows = inventorySeed) => sum(stockForItem(itemNumber, rows), 'balance')
export const totalReserved = (itemNumber, rows = inventorySeed) => sum(stockForItem(itemNumber, rows), 'reserved')

export const totalAvailable = (itemNumber, rows = inventorySeed) =>
  Math.max(0, totalBalance(itemNumber, rows) - totalReserved(itemNumber, rows))

export const storesHolding = (itemNumber, rows = inventorySeed) =>
  stockForItem(itemNumber, rows).filter(row => Number(row.balance) > 0).map(row => row.storeroom)

// A material is only "Available" when what is free across all stores clears its reorder level.
export const availabilityFor = (item, rows = inventorySeed) => {
  const available = totalAvailable(item?.itemNumber, rows)
  return available > 0 && available > Number(item?.reorderLevel || 0) ? 'Available' : 'Purchase Required'
}

export const storeSummary = (materials = [], rows = inventorySeed) => storerooms.map(store => {
  const stock = stockForStore(store.code, rows)
  return {
    ...store,
    locationDescription: storeLocation(store.code)?.description || '',
    itemCount: stock.length,
    totalQuantity: sum(stock, 'balance'),
    totalReserved: sum(stock, 'reserved'),
    belowReorder: stock.filter(row => {
      const material = materials.find(item => clean(item.itemNumber) === clean(row.itemNumber))
      return material && Number(row.balance) - Number(row.reserved) <= Number(material.reorderLevel || 0)
    }).length
  }
})

export const storeStockRows = (storeCode, materials = [], rows = inventorySeed) =>
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
      reorderLevel: Number(material.reorderLevel) || 0
    }
  })
