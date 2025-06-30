# Contributing to Open Parliament Romania

Thank you for your interest in contributing to Open Parliament Romania! This project aims to make Romanian parliamentary data more accessible and transparent.

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or suggest features
- Include relevant details: error messages, expected vs actual behavior, steps to reproduce
- For data accuracy issues, please include links to official sources

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch** from `main`
3. **Make your changes**
4. **Test thoroughly** - run scrapers and verify data quality
5. **Submit a pull request**

### Adding New Scrapers

See the [README.md](README.md#adding-new-scrapers) for detailed instructions on adding new scrapers.

### Development Setup

```bash
# Install dependencies
bun install

# Run specific scrapers
bun scrape --deputies --verbose

# Run all scrapers
bun scrape --all

# Format code
bun run format

# Lint code
bun run lint
```

## Code Standards

- Use TypeScript with strict type checking
- Follow the existing code style (enforced by Biome)
- Add proper error handling and logging
- Include appropriate delays and caching to be respectful to target websites
- Document any changes to data formats in both code and README

## Data Guidelines

- Ensure scraped data follows existing JSON schemas
- Version scrapers when making breaking changes to data formats
- Test scrapers thoroughly before submitting
- Be mindful of website load - use caching and delays appropriately

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Include tests for new functionality
- Ensure CI passes
- Keep PRs focused and reasonably sized

## Questions?

Open an issue for questions about contributing, development setup, or project direction.

## License

By contributing, you agree that your contributions will be licensed under the same licenses as the project:
- Code: MIT License
- Data: CC BY 4.0

Thank you for helping make Romanian parliamentary data more accessible!
