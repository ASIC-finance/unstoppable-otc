import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageFallback } from './components/PageFallback'
import { ToastHost } from './components/ToastHost'

const OrderBook = lazy(() => import('./pages/OrderBook').then(m => ({ default: m.OrderBook })))
const CreateOrder = lazy(() => import('./pages/CreateOrder').then(m => ({ default: m.CreateOrder })))
const MyOrders = lazy(() => import('./pages/MyOrders').then(m => ({ default: m.MyOrders })))

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<OrderBook />} />
                <Route path="/create" element={<CreateOrder />} />
                <Route path="/my-orders" element={<MyOrders />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
        <ToastHost />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
