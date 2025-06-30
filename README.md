# Open Parliament Romania

Automated scraper for collecting data from the Romanian Parliament. Currently focuses on the Chamber of Deputies (Camera Deputaților) with plans to expand to the full Parliament.

## Features

- Automated data collection for deputies, speeches, motions, interpellations, and proposals
- Caching to minimize server load
- Flexible CLI for running specific scrapers or all at once
- Progress tracking for long-running jobs
- Automated updates via GitHub Actions, no need for a dedicated server

## Installation

```bash
bun install
```

## Usage

```bash
# Run all scrapers
bun scrape --all

# Run specific scrapers
bun scrape --deputies --deputies_detail

# Enable verbose logging
bun scrape --verbose --all

# View available scrapers
bun scrape
```

## Data Structure

All scraped data is stored in the `data/` directory organized by year:

```
data/
├── 2024/                          # Year when the parliament was elected
│   ├── deputies.json              # List of all deputies
│   ├── full-deputies/             # Detailed deputy profiles
│   ├── speeches/                  # Deputy speeches
│   ├── motions/                   # Deputy motions
│   ├── interpellations/           # Deputy interpellations
│   └── proposals/                 # Deputy proposals
```

## Automated Updates

The scraper runs every 3 hours via GitHub Actions. Safe changes (additions and modifications) are committed directly to main, while potentially destructive changes (deletions) create pull requests for review. Since all data is stored in git, you can easily revert to any previous state if scrapers break due to website changes.

## Development

### Project Structure

```
src/
├── jobs/                          # Scraper job definitions
├── lib/
│   ├── scrapers/                  # Core scraping logic
│   ├── cache.ts                   # Caching utilities
│   ├── log.ts                     # Logging configuration
│   └── runScraper.ts              # Scraper execution 
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Adding New Scrapers

1. Create a new job file in `src/jobs/`
2. Implement the `ScraperJob` interface
3. The scraper will automatically be discovered and available via CLI
4. **Important**: If you change data formats, increment the scraper version number
5. **Important**: If you scrape new data, ensure it is properly documented in the `README.md` and `DATA_LICENSE.md`

## Usage Notes

- The scraper includes delays and caching to be respectful to target websites
- Always verify critical information from official sources
- Website changes may break scrapers - git history allows easy rollback if needed

## Roadmap

### Essential Features for First Release Candidate

1. **Data completeness** - Include Senate data from [senat.ro](https://senat.ro)
2. **Include votes** - Parliamentary voting records and outcomes
3. **Include other entities** - Groups of friendship (Grupuri de prietenie) and other parliamentary entities
4. **Potentially include transcripts** - Full session transcripts (pending size/storage considerations)
5. **Standardize data format** - Define JSON schemas and eliminate ID recycling issues (deputies currently get IDs 1..N that are recycled each election)
6. **Parliamentary profile completeness** - Contact information, resumes, and other important biographical data

### Out of Scope for First Release

1. **Data enrichment and cleanup** - Using LLMs or other AI tools for data enhancement
2. **Standardizing complex resources** - Some resources, such as legislative proposals, have complex structures that are out of scope for the first release
3. **Extracting data from scanned documents** - OCR and document parsing capabilities

## License

This project uses dual licensing:

- **Code**: [MIT License](LICENSE) - Use, modify, and distribute the scraper code freely
- **Data**: [CC BY 4.0](DATA_LICENSE.md) - Use the scraped data with attribution

The scraped data comes with important disclaimers about accuracy and completeness. See [DATA_LICENSE.md](DATA_LICENSE.md) for full details.

---

Made with ❤️ in Romania
