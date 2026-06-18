import express from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

// POST create order (buyers only)
router.post('/', protect, requireRole('buyer'), async (req, res) => {
  try {
    const { items } = req.body
    // items = [{ product_id, quantity }]

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order' })
    }

    // Fetch product prices from DB (never trust frontend prices)
    const productIds = items.map(i => i.product_id)
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, price_per_unit, quantity_available, name')
      .in('id', productIds)

    if (productError) return res.status(400).json({ error: productError.message })

    // Validate quantities and calculate total
    let total = 0
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id)
      if (!product) return res.status(404).json({ error: `Product not found` })
      if (item.quantity > product.quantity_available) {
        return res.status(400).json({ error: `Not enough stock for ${product.name}` })
      }
      total += product.price_per_unit * item.quantity
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: req.user.id,
        total_amount: total,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError) return res.status(400).json({ error: orderError.message })

    // Create order items
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id)
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: product.price_per_unit
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) return res.status(400).json({ error: itemsError.message })

    // Reduce stock for each product
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id)
      await supabase
        .from('products')
        .update({ quantity_available: product.quantity_available - item.quantity })
        .eq('id', item.product_id)
    }

    res.status(201).json({ message: 'Order placed successfully', order })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET buyer's own orders
router.get('/my-orders', protect, requireRole('buyer'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_purchase,
          products (name, unit, image_url)
        )
      `)
      .eq('buyer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })

    res.json({ orders: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET farmer's incoming orders
router.get('/farmer-orders', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        products (name, unit, image_url, farmer_id),
        orders (id, status, total_amount, created_at, buyer_id,
          profiles (name, phone)
        )
      `)
      .eq('products.farmer_id', req.user.id)

    if (error) return res.status(400).json({ error: error.message })

    res.json({ orders: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET single order
router.get('/:id', protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          price_at_purchase,
          products (name, unit, image_url)
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error) return res.status(404).json({ error: 'Order not found' })

    res.json({ order: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH update order status (farmer only)
router.patch('/:id/status', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['confirmed', 'dispatched', 'delivered', 'cancelled']

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })

    res.json({ message: 'Order status updated', order: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router