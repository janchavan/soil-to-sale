import express from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

// GET all products (public - anyone can view)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query

    let query = supabase
      .from('products')
      .select(`
        *,
        profiles (name, location)
      `)
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })

    res.json({ products: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`*, profiles (name, location)`)
      .eq('id', req.params.id)
      .single()

    if (error) return res.status(404).json({ error: 'Product not found' })

    res.json({ product: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET farmer's own products
router.get('/farmer/my-products', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('farmer_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) return res.status(400).json({ error: error.message })

    res.json({ products: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST create product (farmers only)
router.post('/', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { name, category, price_per_unit, unit, quantity_available, description, image_url } = req.body

    if (!name || !price_per_unit || !unit || !quantity_available) {
      return res.status(400).json({ error: 'Name, price, unit and quantity are required' })
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        farmer_id: req.user.id,
        name,
        category,
        price_per_unit,
        unit,
        quantity_available,
        description,
        image_url
      })
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })

    res.status(201).json({ message: 'Product created', product: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH update product (farmer who owns it only)
router.patch('/:id', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { name, category, price_per_unit, unit, quantity_available, description, image_url } = req.body

    const { data, error } = await supabase
      .from('products')
      .update({ name, category, price_per_unit, unit, quantity_available, description, image_url })
      .eq('id', req.params.id)
      .eq('farmer_id', req.user.id)
      .select()
      .single()

    if (error) return res.status(400).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Product not found or not yours' })

    res.json({ message: 'Product updated', product: data })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE product (farmer who owns it only)
router.delete('/:id', protect, requireRole('farmer'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id)
      .eq('farmer_id', req.user.id)

    if (error) return res.status(400).json({ error: error.message })

    res.json({ message: 'Product deleted' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router