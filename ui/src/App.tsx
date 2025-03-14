import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchResults from './pages/SearchResults';
import BlogResults from './pages/BlogResults';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/blog" element={<BlogResults />} />
      </Routes>
    </Router>
  );
}

export default App;