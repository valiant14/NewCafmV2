export const seedMeters = (assets = [], workOrders = []) => {
  const assetMeters = assets.slice(0, 6).map((asset, index) => ({
    meterId: `MTR-${String(index + 1).padStart(4, '0')}`,
    asset: asset.assetnum,
    location: asset.location,
    site: String(asset.site || '1031'),
    department: asset.department || asset['sub department'] || 'Facilities',
    meterType: index % 2 ? 'Water' : 'Energy',
    reading: String(1200 + index * 145),
    unit: index % 2 ? 'm3' : 'kWh',
    readingDate: `2026-07-${String(10 + index).padStart(2, '0')}`,
    status: 'Active'
  }))

  const workOrderMeters = workOrders
    .filter(order => order['METER READING'])
    .map((order, index) => ({
      meterId: `WO-MTR-${order.WORKORDER || index + 1}`,
      asset: order.ASSET || '',
      location: order['LOCATION '] || '',
      site: String(order.SITE || ''),
      department: order['DEPARTMENT '] || '',
      meterType: 'General',
      reading: order['METER READING'],
      unit: '',
      readingDate: order['METER READING DATE'] || '',
      status: 'Active'
    }))

  return [...assetMeters, ...workOrderMeters]
}
