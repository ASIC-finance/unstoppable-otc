import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { OrderBook } from './pages/OrderBook'
import { CreateOrder } from './pages/CreateOrder'
import { MyOrders } from './pages/MyOrders'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<OrderBook />} />
          <Route path="/create" element={<CreateOrder />} />
          <Route path="/my-orders" element={<MyOrders />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
