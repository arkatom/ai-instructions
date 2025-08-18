# Django Patterns

## MVT Architecture

### Model-View-Template Structure
Organize Django components properly.

```python
# models.py - Data layer
from django.db import models
from django.contrib.auth import get_user_model

class Article(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    author = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)
    content = models.TextField()
    published_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-published_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['-published_at']),
        ]
    
    def __str__(self):
        return self.title

# views.py - Business logic
from django.shortcuts import get_object_or_404
from django.views.generic import ListView, DetailView

class ArticleListView(ListView):
    model = Article
    template_name = 'articles/list.html'
    context_object_name = 'articles'
    paginate_by = 10
    
    def get_queryset(self):
        return Article.objects.select_related('author').prefetch_related('tags')

# urls.py - URL routing
from django.urls import path

app_name = 'articles'
urlpatterns = [
    path('', ArticleListView.as_view(), name='list'),
    path('<slug:slug>/', ArticleDetailView.as_view(), name='detail'),
]
```

## Query Optimization

### Select and Prefetch Related
Minimize database queries.

```python
# Good - Avoid N+1 queries
articles = Article.objects.select_related('author').prefetch_related('comments')

# Use only() for specific fields
articles = Article.objects.only('title', 'slug', 'published_at')

# Use defer() to exclude heavy fields
articles = Article.objects.defer('content')

# Annotate with aggregations
from django.db.models import Count, Avg
articles = Article.objects.annotate(
    comment_count=Count('comments'),
    avg_rating=Avg('ratings__score')
)

# Bad - N+1 query problem
articles = Article.objects.all()
for article in articles:
    print(article.author.name)  # Hits DB each time
```

## Custom Managers and QuerySets

### Encapsulate Business Logic
Keep query logic in models.

```python
# Good
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(status='published')

class ArticleQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status='published')
    
    def by_author(self, author):
        return self.filter(author=author)
    
    def recent(self, days=7):
        from django.utils import timezone
        from datetime import timedelta
        return self.filter(
            published_at__gte=timezone.now() - timedelta(days=days)
        )

class Article(models.Model):
    objects = ArticleQuerySet.as_manager()
    published = PublishedManager()
    
    # Usage
    recent_articles = Article.objects.published().recent(30)
```

## Form Handling

### ModelForms and Validation
Handle form data properly.

```python
# forms.py
from django import forms
from django.core.exceptions import ValidationError

class ArticleForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = ['title', 'content', 'tags']
        widgets = {
            'content': forms.Textarea(attrs={'rows': 10}),
        }
    
    def clean_title(self):
        title = self.cleaned_data['title']
        if Article.objects.filter(title__iexact=title).exists():
            raise ValidationError('Article with this title already exists')
        return title
    
    def save(self, commit=True):
        article = super().save(commit=False)
        article.slug = slugify(article.title)
        if commit:
            article.save()
            self.save_m2m()
        return article

# views.py
from django.contrib import messages

class ArticleCreateView(LoginRequiredMixin, CreateView):
    model = Article
    form_class = ArticleForm
    
    def form_valid(self, form):
        form.instance.author = self.request.user
        messages.success(self.request, 'Article created successfully')
        return super().form_valid(form)
```

## Authentication and Permissions

### Custom User Model and Permissions
Implement proper access control.

```python
# models.py
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    
    def can_edit_article(self, article):
        return self == article.author or self.is_staff

# views.py
from django.contrib.auth.mixins import UserPassesTestMixin

class ArticleUpdateView(UserPassesTestMixin, UpdateView):
    model = Article
    
    def test_func(self):
        article = self.get_object()
        return self.request.user.can_edit_article(article)

# Custom permission
from django.contrib.auth.decorators import user_passes_test

def is_author(user):
    return user.groups.filter(name='Authors').exists()

@user_passes_test(is_author)
def create_article(request):
    # View logic
```

## Middleware

### Custom Middleware
Process requests globally.

```python
# Good
class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Before view
        request.request_id = str(uuid.uuid4())
        
        response = self.get_response(request)
        
        # After view
        logger.info(f'Request {request.request_id} completed with status {response.status_code}')
        
        return response
    
    def process_exception(self, request, exception):
        logger.error(f'Request {request.request_id} failed: {exception}')
        return None
```

## Caching

### Cache Strategies
Optimize performance with caching.

```python
# Good - Multiple cache strategies
from django.core.cache import cache
from django.views.decorators.cache import cache_page
from django.core.cache.utils import make_template_fragment_key

# View caching
@cache_page(60 * 15)  # Cache for 15 minutes
def article_list(request):
    # View logic

# Low-level caching
def get_popular_articles():
    key = 'popular_articles'
    articles = cache.get(key)
    
    if articles is None:
        articles = Article.objects.annotate(
            view_count=Count('views')
        ).order_by('-view_count')[:10]
        cache.set(key, articles, 60 * 30)  # 30 minutes
    
    return articles

# Template fragment caching
{% load cache %}
{% cache 500 article_list request.user.id %}
    <!-- Expensive template rendering -->
{% endcache %}

# Invalidate cache on save
def save(self, *args, **kwargs):
    super().save(*args, **kwargs)
    cache.delete('popular_articles')
```

## Signals

### Decoupled Event Handling
React to model events.

```python
# Good - Use signals for decoupled logic
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

@receiver(post_save, sender=Article)
def create_article_slug(sender, instance, created, **kwargs):
    if created and not instance.slug:
        instance.slug = slugify(instance.title)
        instance.save()

@receiver(pre_delete, sender=Article)
def cleanup_article_files(sender, instance, **kwargs):
    # Clean up associated files
    if instance.featured_image:
        instance.featured_image.delete(save=False)

# Custom signals
from django.dispatch import Signal

article_viewed = Signal()

# In view
article_viewed.send(sender=Article, article=article, user=request.user)
```

## Testing

### Comprehensive Test Coverage
Test models, views, and forms.

```python
# Good
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse

class ArticleModelTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='testuser',
            password='testpass'
        )
    
    def test_article_creation(self):
        article = Article.objects.create(
            title='Test Article',
            author=self.user,
            content='Test content'
        )
        self.assertEqual(str(article), 'Test Article')
        self.assertTrue(article.slug)

class ArticleViewTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = get_user_model().objects.create_user(
            username='testuser',
            password='testpass'
        )
    
    def test_article_list_view(self):
        response = self.client.get(reverse('articles:list'))
        self.assertEqual(response.status_code, 200)
    
    def test_article_create_requires_login(self):
        response = self.client.get(reverse('articles:create'))
        self.assertEqual(response.status_code, 302)  # Redirect to login
```

## Best Practices Checklist

- [ ] Use custom User model from the start
- [ ] Implement proper database indexes
- [ ] Use select_related and prefetch_related
- [ ] Create custom managers for business logic
- [ ] Use Django's built-in security features
- [ ] Implement proper caching strategy
- [ ] Write comprehensive tests
- [ ] Use environment variables for settings
- [ ] Handle static files properly
- [ ] Use Django Debug Toolbar in development
- [ ] Implement proper logging
- [ ] Use database transactions appropriately