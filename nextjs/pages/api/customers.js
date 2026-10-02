export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/customers');
      const data = await response.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json([]);
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
