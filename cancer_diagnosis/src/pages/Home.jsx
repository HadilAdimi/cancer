import { useEffect, useState } from "react";
import "./Home.css";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [articles, setArticles] = useState([]);
  const [selectedType, setSelectedType] = useState("Brain Tumor"); // Fixed: Capital 'T'
  const navigate = useNavigate();

  const cancerTypes = [
    {
      name: "Brain Tumor",
      image: "./imgs/brain.png"
    },
    {
      name: "Lung cancer",
      image: "./imgs/lung.png"
    },
    {
      name: "Breast cancer",
      image: "./imgs/breast.png"
    },
    {
      name: "Kidney cancer",
      image: "./imgs/kidney.png"
    },
    {
      name: "Colorectal cancer",
      image: "./imgs/colon.png"
    },
    {
      name: "Liver cancer",
      image: "./imgs/liver.png"
    },
    {
      name: "Eye cancer",
      image: "./imgs/eye.png"
    }
  ];
  
  const imagemap = {
    "Brain Tumor": "./imgs/braincancer.jpg",
    "Lung cancer": "./imgs/lungcancer.jpg",
    "Breast cancer": "./imgs/breastcancer.jpg",
    "Kidney cancer": "./imgs/kidneycancer.jpg",
    "Colorectal cancer": "./imgs/coloncancer.jpg",
    "Liver cancer": "./imgs/livercancer.jpg",
    "Eye cancer": "./imgs/eyecancer.jpg"
  };

  const [stats, setStats] = useState({
    articles: 0,
    types: 0,
    studies: 0,
    accuracy: 0
  });

  useEffect(() => {
    const target = {
      articles: 1200,
      types: 30,
      studies: 1000,
      accuracy: 95
    };

    const duration = 1200;
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;

      setStats({
        articles: Math.floor((target.articles / steps) * currentStep),
        types: Math.floor((target.types / steps) * currentStep),
        studies: Math.floor((target.studies / steps) * currentStep),
        accuracy: Math.floor((target.accuracy / steps) * currentStep)
      });

      if (currentStep === steps) {
        clearInterval(timer);
        setStats(target);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchArticles(selectedType);
  }, [selectedType]);

  const fetchArticles = (type) => {
    // Show loading state (optional)
    setArticles([]);
    
    fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(type)}&retmode=json&retmax=9`
    )
      .then((res) => res.json())
      .then((data) => {
        const ids = data.esearchresult?.idlist || [];
        
        if (ids.length === 0) {
          setArticles([]);
          return;
        }

        return fetch(
          `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`
        );
      })
      .then((res) => res?.json())
      .then((data) => {
        if (data && data.result) {
          const results = Object.values(data.result).slice(1);
          const enriched = results
            .filter((item) => item.uid && item.title)
            .map((item) => ({
              ...item,
              image: imagemap[selectedType]
            }));
          setArticles(enriched);
        } else {
          setArticles([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching articles:", error);
        setArticles([]);
      });
  };

  return (
    <div className="home">

      {/* Navbar */}
      <nav className="navbar">
        <h1 className="logo">MedIntel</h1>
        <button className="login-btn" onClick={() => navigate("/login")}>
          Log In
        </button>
      </nav>

      {/* Hero */}
      <section className="hero">

        <div className="hero-content">
          <h2>Advanced Cancer Research Platform</h2>
          <p>
            An Intelligent platform that leverages AI to analyze medical data, providing insights and predictions to support cancer diagnosis and treatment decisions.
          </p>

          <div className="hero-actions">
            <button className="primary-btn" onClick={() => 
              document 
              .getElementById("research-section")
              .scrollIntoView({ behavior: "smooth"})
            }>Explore Research</button>
            <button className="secondary-btn" onClick={() =>
              document
              .getElementById("statistics")
              .scrollIntoView({behavior: "smooth"})
            }>Learn More</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="shape big"></div>
          <div className="shape medium"></div>
          <div className="shape small"></div>
          <img src="./imgs/imag.png" className="hero-img" alt="hero" />
        </div>
      </section>

      <section className="stats" id="statistics">
        <div className="stat-card">
          <h3>{stats.articles}+</h3>
          <p>Research Articles</p>
        </div>

        <div className="stat-card">
          <h3>{stats.types}+</h3>
          <p>Cancer Types</p>
        </div>

        <div className="stat-card">
          <h3>{stats.studies}+</h3>
          <p>Clinical Studies</p>
        </div>

        <div className="stat-card">
          <h3>{stats.accuracy}%</h3>
          <p>Data Accuracy</p>
        </div>
      </section>

      {/* Cancer Types */}
      <h1 className="label">Cancer Types</h1>
      <section className="types">
        {cancerTypes.map((type, i) => (
          <div
            key={i}
            className={`type-card ${
              selectedType === type.name ? "active" : ""
            }`}
            onClick={() => setSelectedType(type.name)}
          >
            <img src={type.image} alt={type.name} />
            <span>{type.name}</span>
          </div>
        ))}
      </section>

      {/* Articles */}
      <h1 className="label">Research Articles</h1>
      <section className="research" id="research-section">
        {articles.length === 0 ? (
          <div className="loading-articles">
            <p>Loading articles about {selectedType}...</p>
          </div>
        ) : (
          articles
            .filter((article) => article.title && article.uid)
            .map((article, i) => (
              <div key={i} className="card">
                <img src={article.image} alt={selectedType} className="card-img" />
                <h3>{article.title}</h3>
                <p>{article.source}</p>
                <span>{article.pubdate}</span>
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read study
                </a>
              </div>
            ))
        )}
      </section>

      <footer className="footer">
        <p>© 2026 MedIntel. All rights reserved to H.ADIMI & O.AMROUNE.</p>
      </footer>
    </div>

    
  );
}