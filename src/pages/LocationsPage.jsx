import { MapPin, Plus } from 'lucide-react'

export default function LocationsPage(){return <><section className="page-heading"><div><p className="eyebrow">PORTFOLIO</p><h1>Locations</h1><p>Manage the facility hierarchy across sites and buildings.</p></div><button className="primary"><Plus size={17}/>Add location</button></section><section className="panel"><div className="empty-state"><MapPin size={30}/><h3>No location records yet</h3><p>The Excel location file contains its field structure but no rows. Add locations when the source is ready.</p></div></section></>}
